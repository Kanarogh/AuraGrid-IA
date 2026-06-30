import { GoogleGenAI, Type } from "@google/genai";
import {
  buildRefineCaptionPrompt,
  resolveBrandGemFromBody,
} from "./brandContext";
import {
  buildMatchJsonCatalogTask,
  buildMatchImagesCatalogTask,
  buildCatalogProfilesPromptSection,
  buildMatchResultInstructions,
  buildImageOnlyCaptionTask,
  buildImageOnlyResultInstructions,
  buildCaptionPromptOptions,
  buildCaptionOnlyTask,
  buildCaptionOnlyResultInstructions,
  buildFingerprintMatchTask,
  buildFingerprintMatchSection,
  isImageOnlyCaptionMode,
  normalizeMatchedId,
  resolveMatchedIdFromCandidates,
} from "./matchPrompts";
import { buildEnrichCatalogPrompt } from "./catalogProfile";
import {
  buildCatalogSelfCritiquePrompt,
  coerceCatalogProfile,
  finalizeDeepCatalogProfile,
  findSiblingCatalogLabels,
  type CatalogSelfCritique,
} from "./catalogProfileV2";
import { CATALOG_PROFILE_SCHEMA, CATALOG_SELF_CRITIQUE_SCHEMA } from "../geminiShared";
import {
  getGeminiIndexingModel,
  getGeminiPlanningModel,
  getGeminiReferenceModel,
  hasGeminiKey,
} from "./config";
import {
  buildPostFingerprintPrompt,
  normalizePostFingerprint,
} from "./postFingerprint";
import { callGeminiIndexing, callGeminiPlanning } from "./geminiRetry";
import { parseGeminiJsonText, isJsonParseError } from "./geminiJson";
import { cleanBase64, shrinkImageDataUrlForVision, sleep } from "./shared";
import { recordAiUsageEvent } from "../services/aiUsageService";
import type {
  AiProvider,
  CaptionOnlyInput,
  CatalogEnrichInput,
  MatchFromFingerprintInput,
  MatchGenerateInput,
  MatchGenerateResult,
} from "./types";

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY não configurada no .env");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { "User-Agent": "aurastudio-build" } },
  });
}

async function trackGeminiUsage(args: {
  operation: string;
  model: string;
  response: unknown;
  clientId?: string;
}) {
  try {
    const usageMetadata = (args.response as { usageMetadata?: unknown } | null | undefined)
      ?.usageMetadata;
    await recordAiUsageEvent({
      operation: args.operation,
      provider: "gemini",
      model: args.model,
      usageMetadata,
      clientId: args.clientId,
    });
  } catch (error) {
    console.warn("[ai-usage] falha ao registrar uso Gemini:", error);
  }
}

/** Limite de saída — perfil compacto cabe em ~1–2 KB; evita JSON truncado gigante. */
const CATALOG_INDEXING_MAX_OUTPUT_TOKENS = 4096;

const CATALOG_INDEXING_CONFIG = {
  responseMimeType: "application/json" as const,
  maxOutputTokens: CATALOG_INDEXING_MAX_OUTPUT_TOKENS,
};

export const geminiProvider: AiProvider = {
  id: "gemini",
  getModel: getGeminiPlanningModel,
  isConfigured: hasGeminiKey,

  async analyzePostVisual({ postImage, purpose }) {
    const ai = getClient();
    const primaryModel = purpose === "reference" ? getGeminiReferenceModel() : getGeminiPlanningModel();
    let modelUsed = primaryModel;
    const response = await callGeminiPlanning(
      primaryModel,
      "Gemini fingerprint",
      (model) =>
        ai.models.generateContent({
          model,
          contents: [
            { text: buildPostFingerprintPrompt() },
            { inlineData: cleanBase64(postImage) },
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                garmentType: { type: Type.STRING },
                dominantColorFamily: { type: Type.STRING },
                primaryColors: { type: Type.ARRAY, items: { type: Type.STRING } },
                patternType: { type: Type.STRING },
                printScale: { type: Type.STRING },
                neckline: { type: Type.STRING },
                sleeves: { type: Type.STRING },
                dressLength: { type: Type.STRING },
                silhouette: { type: Type.STRING },
                visibleAnchors: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ["garmentType", "dominantColorFamily", "primaryColors", "visibleAnchors"],
            },
          },
        })
    ,
      { onSuccess: (model) => (modelUsed = model) }
    );
    await trackGeminiUsage({
      operation: "analyze_post_visual",
      model: modelUsed,
      response,
    });
    const rawText = response.text?.trim();
    if (!rawText) throw new Error("Gemini retornou resposta vazia.");
    return normalizePostFingerprint(JSON.parse(rawText) as Record<string, unknown>);
  },

  async enrichCatalogItem({ image, label, id, siblingCandidates, deepIndexing, onProgress }: CatalogEnrichInput) {
    const report = (phase: string, itemPercent: number, stepLabel?: string) => {
      onProgress?.({ phase, itemPercent, stepLabel });
    };

    const ai = getClient();
    report("analyze", 20);
    const shrunk = await shrinkImageDataUrlForVision(image, {
      maxSide: 1536,
      quality: 0.88,
    });
    report("analyze", 26);
    let modelUsed = getGeminiIndexingModel();

    let phaseARaw: Record<string, unknown> | null = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const phaseAResponse = await callGeminiIndexing(
          getGeminiIndexingModel(),
          "Gemini enrich phase A",
          (model) =>
            ai.models.generateContent({
              model,
              contents: [
                { text: buildEnrichCatalogPrompt(label, id) },
                { inlineData: cleanBase64(shrunk) },
              ],
              config: {
                ...CATALOG_INDEXING_CONFIG,
                responseSchema: CATALOG_PROFILE_SCHEMA,
              },
            }),
          { onSuccess: (model) => (modelUsed = model) }
        );
        report("analyze", 48);
        await trackGeminiUsage({
          operation: "enrich_catalog_item",
          model: modelUsed,
          response: phaseAResponse,
        });
        phaseARaw = parseGeminiJsonText<Record<string, unknown>>(
          phaseAResponse.text,
          "Fase A"
        );
        break;
      } catch (err) {
        if (attempt >= 2) throw err;
        if (!isJsonParseError(err)) throw err;
        console.warn("[enrich] Fase A JSON inválido — nova tentativa Gemini…");
        await sleep(1200);
      }
    }
    if (!phaseARaw) throw new Error("Gemini retornou resposta vazia na Fase A.");

    let critique: CatalogSelfCritique | null = null;

    if (deepIndexing !== false) {
      const draft = coerceCatalogProfile(phaseARaw, label);
      report("refine", 52);
      const siblingLabels = siblingCandidates?.length
        ? findSiblingCatalogLabels(
            siblingCandidates.map((c) => ({
              id: c.id,
              label: c.label,
              profile: coerceCatalogProfile(c.profile, c.label),
            })),
            draft,
            id
          )
        : [];
      report("refine", 58);

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const critiqueResponse = await callGeminiIndexing(
            getGeminiIndexingModel(),
            "Gemini enrich phase B",
            (model) =>
              ai.models.generateContent({
                model,
                contents: [
                  {
                    text: buildCatalogSelfCritiquePrompt(
                      label,
                      id,
                      draft,
                      siblingLabels
                    ),
                  },
                  { inlineData: cleanBase64(shrunk) },
                ],
                config: {
                  ...CATALOG_INDEXING_CONFIG,
                  responseSchema: CATALOG_SELF_CRITIQUE_SCHEMA,
                },
              }),
            { onSuccess: (model) => (modelUsed = model) }
          );
          report("refine", 82);
          await trackGeminiUsage({
            operation: "enrich_catalog_critique",
            model: modelUsed,
            response: critiqueResponse,
          });
          const critiqueText = critiqueResponse.text?.trim();
          if (critiqueText) {
            critique = parseGeminiJsonText<CatalogSelfCritique>(
              critiqueText,
              "Fase B"
            );
          }
          break;
        } catch (err) {
          if (attempt >= 2) throw err;
          if (!isJsonParseError(err)) throw err;
          console.warn("[enrich] Fase B JSON inválido — nova tentativa Gemini…");
          await sleep(1200);
        }
      }
    } else {
      report("refine", 82);
    }

    report("save", 84);
    const { profile } = finalizeDeepCatalogProfile(phaseARaw, critique, label);
    return profile;
  },

  async matchAndGenerate(input: MatchGenerateInput): Promise<MatchGenerateResult> {
    const ai = getClient();
    const primaryModel = input.matchOnly ? getGeminiReferenceModel() : getGeminiPlanningModel();
    let modelUsed = primaryModel;
    const { postImage, matchOnly, regenerateCaption } = input;
    const catalogProfiles = input.catalogProfiles;
    const catalogItems = input.catalogProfiles?.length ? undefined : input.catalogItems;
    const gem = resolveBrandGemFromBody(input);

    if (isImageOnlyCaptionMode(input)) {
      const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [
        { text: buildImageOnlyCaptionTask(gem) },
        { inlineData: cleanBase64(postImage) },
        {
          text: buildImageOnlyResultInstructions(gem, buildCaptionPromptOptions(input, true)),
        },
      ];

      const response = await callGeminiPlanning(
        primaryModel,
        "Gemini image-only caption",
        (model) =>
          ai.models.generateContent({
            model,
            contents: parts,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  matchedId: { type: Type.STRING },
                  reasoning: { type: Type.STRING },
                  caption: { type: Type.STRING },
                },
                required: ["matchedId", "reasoning", "caption"],
              },
            },
          })
      ,
        { onSuccess: (model) => (modelUsed = model) }
      );
      await trackGeminiUsage({
        operation: "match_and_generate_image_only",
        model: modelUsed,
        response,
        clientId: input.clientId,
      });

      const parsed = JSON.parse(response.text || "{}") as Omit<MatchGenerateResult, "matchMode"> & {
        caption?: string;
      };
      return {
        matchedId: null,
        reasoning: parsed.reasoning ?? "",
        caption: parsed.caption ?? "",
        matchMode: "image_only",
      };
    }

    const profiles = Array.isArray(catalogProfiles) ? catalogProfiles : [];
    const useTextCatalog =
      profiles.length > 0 && profiles.every((p) => p?.profile);

    const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [];

    if (useTextCatalog) {
      parts.push({
        text: buildMatchJsonCatalogTask(!!matchOnly, gem),
      });
      parts.push({ inlineData: cleanBase64(postImage) });
      parts.push({
        text: `\n${buildCatalogProfilesPromptSection(profiles, {
          matchRankHint: input.matchRankHint,
          brief: true,
        })}`,
      });
    } else {
      parts.push({
        text: buildMatchImagesCatalogTask(!!matchOnly, gem),
      });
      parts.push({ inlineData: cleanBase64(postImage) });

      if (catalogItems && catalogItems.length > 0) {
        parts.push({ text: "\nCandidate catalog photos:" });
        catalogItems.forEach((item, idx) => {
          parts.push({
            text: `\n[CANDIDATE #${idx + 1}] ID: "${item.id}" Label: "${item.label}"`,
          });
          parts.push({ inlineData: cleanBase64(item.image) });
        });
      } else {
        parts.push({ text: "\n(No catalog candidates — matchedId null.)" });
      }
    }

    parts.push({
      text: buildMatchResultInstructions(gem, !!matchOnly, buildCaptionPromptOptions(input, true)),
    });

    const response = await callGeminiPlanning(
      primaryModel,
      "Gemini match",
      (model) =>
        ai.models.generateContent({
          model,
          contents: parts,
          config: {
            responseMimeType: "application/json",
            responseSchema: matchOnly
              ? {
                  type: Type.OBJECT,
                  properties: {
                    matchedId: { type: Type.STRING },
                    reasoning: { type: Type.STRING },
                  },
                  required: ["matchedId", "reasoning"],
                }
              : {
                  type: Type.OBJECT,
                  properties: {
                    matchedId: { type: Type.STRING },
                    reasoning: { type: Type.STRING },
                    caption: { type: Type.STRING },
                  },
                  required: ["matchedId", "reasoning", "caption"],
                },
          },
        })
    ,
      { onSuccess: (model) => (modelUsed = model) }
    );
    await trackGeminiUsage({
      operation: input.matchOnly ? "match_reference" : "match_and_generate",
      model: modelUsed,
      response,
      clientId: input.clientId,
    });

    const parsed = JSON.parse(response.text || "{}") as Omit<MatchGenerateResult, "matchMode"> & {
      caption?: string;
    };
    const candidateProfiles = useTextCatalog
      ? profiles.map((p) => ({ id: p.id, label: p.label }))
      : (catalogItems ?? []).map((c) => ({ id: c.id, label: c.label }));
    return {
      matchedId: resolveMatchedIdFromCandidates(parsed.matchedId, candidateProfiles),
      reasoning: parsed.reasoning ?? "",
      caption: matchOnly ? "" : (parsed.caption ?? ""),
      matchMode: useTextCatalog ? "catalog_json" : "catalog_images",
    };
  },

  async generateCaptionOnly(input: CaptionOnlyInput) {
    const gem = resolveBrandGemFromBody(input);
    const ai = getClient();
    let modelUsed = getGeminiPlanningModel();
    const response = await callGeminiPlanning(
      getGeminiPlanningModel(),
      "Gemini caption-only",
      (model) =>
        ai.models.generateContent({
          model,
          contents: [
            { text: buildCaptionOnlyTask(input, gem) },
            { inlineData: cleanBase64(input.postImage) },
            {
              text: buildCaptionOnlyResultInstructions(
                gem,
                buildCaptionPromptOptions(input, true)
              ),
            },
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: { caption: { type: Type.STRING } },
              required: ["caption"],
            },
          },
        })
    ,
      { onSuccess: (model) => (modelUsed = model) }
    );
    await trackGeminiUsage({
      operation: "generate_caption_only",
      model: modelUsed,
      response,
    });
    const parsed = JSON.parse(response.text || "{}") as { caption?: string };
    return { caption: parsed.caption ?? "" };
  },

  async matchFromFingerprint(input: MatchFromFingerprintInput): Promise<MatchGenerateResult> {
    const ai = getClient();
    const primaryModel = input.matchOnly ? getGeminiReferenceModel() : getGeminiPlanningModel();
    const { postFingerprint, matchOnly } = input;
    const gem = resolveBrandGemFromBody(input);
    const profiles = input.catalogProfiles ?? [];

    let modelUsed = primaryModel;
    const response = await callGeminiPlanning(
      primaryModel,
      "Gemini fingerprint match",
      (model) =>
        ai.models.generateContent({
          model,
          contents: [
            { text: buildFingerprintMatchTask(!!matchOnly, gem) },
            {
              text: buildFingerprintMatchSection(postFingerprint, profiles, {
                matchRankHint: input.matchRankHint,
              }),
            },
            {
              text: buildMatchResultInstructions(
                gem,
                !!matchOnly,
                buildCaptionPromptOptions(input, true)
              ),
            },
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: matchOnly
              ? {
                  type: Type.OBJECT,
                  properties: {
                    matchedId: { type: Type.STRING },
                    reasoning: { type: Type.STRING },
                  },
                  required: ["matchedId", "reasoning"],
                }
              : {
                  type: Type.OBJECT,
                  properties: {
                    matchedId: { type: Type.STRING },
                    reasoning: { type: Type.STRING },
                    caption: { type: Type.STRING },
                  },
                  required: ["matchedId", "reasoning", "caption"],
                },
          },
        })
    ,
      { onSuccess: (model) => (modelUsed = model) }
    );
    await trackGeminiUsage({
      operation: input.matchOnly ? "match_reference_fingerprint" : "match_fingerprint",
      model: modelUsed,
      response,
      clientId: input.clientId,
    });

    const parsed = JSON.parse(response.text || "{}") as Omit<MatchGenerateResult, "matchMode"> & {
      caption?: string;
    };
    const candidateProfiles = profiles.map((p) => ({ id: p.id, label: p.label }));
    return {
      matchedId: resolveMatchedIdFromCandidates(parsed.matchedId, candidateProfiles),
      reasoning: parsed.reasoning ?? "",
      caption: matchOnly ? "" : (parsed.caption ?? ""),
      matchMode: "catalog_json_fingerprint_text",
    };
  },

  async refineCaption(input) {
    const { currentCaption, instructions } = input;
    const gem = resolveBrandGemFromBody(input);
    const ai = getClient();
    const prompt = buildRefineCaptionPrompt(currentCaption, instructions, gem);

    let modelUsed = getGeminiPlanningModel();
    const response = await callGeminiPlanning(
      getGeminiPlanningModel(),
      "Gemini refine caption",
      (model) =>
        ai.models.generateContent({
          model,
          contents: prompt,
        })
    ,
      { onSuccess: (model) => (modelUsed = model) }
    );
    await trackGeminiUsage({
      operation: "refine_caption",
      model: modelUsed,
      response,
    });

    const text = response.text?.trim();
    if (!text) throw new Error("Gemini retornou resposta vazia ao refinar legenda.");
    return text;
  },
};
