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
import { buildEnrichCatalogPrompt, finalizeCatalogProfile } from "./catalogProfile";
import { CATALOG_PROFILE_SCHEMA } from "../geminiShared";
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
import { cleanBase64 } from "./shared";
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
    httpOptions: { headers: { "User-Agent": "auragrid-build" } },
  });
}

export const geminiProvider: AiProvider = {
  id: "gemini",
  getModel: getGeminiPlanningModel,
  isConfigured: hasGeminiKey,

  async analyzePostVisual({ postImage, purpose }) {
    const ai = getClient();
    const primaryModel = purpose === "reference" ? getGeminiReferenceModel() : getGeminiPlanningModel();
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
    );
    const rawText = response.text?.trim();
    if (!rawText) throw new Error("Gemini retornou resposta vazia.");
    return normalizePostFingerprint(JSON.parse(rawText) as Record<string, unknown>);
  },

  async enrichCatalogItem({ image, label, id }: CatalogEnrichInput) {
    const ai = getClient();
    const response = await callGeminiIndexing(
      getGeminiIndexingModel(),
      "Gemini enrich",
      (model) =>
        ai.models.generateContent({
          model,
          contents: [
            { text: buildEnrichCatalogPrompt(label, id) },
            { inlineData: cleanBase64(image) },
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: CATALOG_PROFILE_SCHEMA,
          },
        })
    );

    const rawText = response.text?.trim();
    if (!rawText) throw new Error("Gemini retornou resposta vazia.");

    const profile = JSON.parse(rawText) as Record<string, unknown>;
    return finalizeCatalogProfile(profile, label);
  },

  async matchAndGenerate(input: MatchGenerateInput): Promise<MatchGenerateResult> {
    const ai = getClient();
    const primaryModel = input.matchOnly ? getGeminiReferenceModel() : getGeminiPlanningModel();
    const { postImage, matchOnly, regenerateCaption } = input;
    const catalogProfiles = input.catalogProfiles;
    const catalogItems = input.catalogProfiles?.length ? undefined : input.catalogItems;
    const gem = resolveBrandGemFromBody(input);

    if (isImageOnlyCaptionMode(input)) {
      const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [
        { text: buildImageOnlyCaptionTask(gem) },
        { inlineData: cleanBase64(postImage) },
        {
          text: buildImageOnlyResultInstructions(gem, buildCaptionPromptOptions(input)),
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
      );

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
      text: buildMatchResultInstructions(gem, !!matchOnly, buildCaptionPromptOptions(input)),
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
    );

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
                buildCaptionPromptOptions(input)
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
    );
    const parsed = JSON.parse(response.text || "{}") as { caption?: string };
    return { caption: parsed.caption ?? "" };
  },

  async matchFromFingerprint(input: MatchFromFingerprintInput): Promise<MatchGenerateResult> {
    const ai = getClient();
    const primaryModel = input.matchOnly ? getGeminiReferenceModel() : getGeminiPlanningModel();
    const { postFingerprint, matchOnly } = input;
    const gem = resolveBrandGemFromBody(input);
    const profiles = input.catalogProfiles ?? [];

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
                buildCaptionPromptOptions(input)
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
    );

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

    const response = await callGeminiPlanning(
      getGeminiPlanningModel(),
      "Gemini refine caption",
      (model) =>
        ai.models.generateContent({
          model,
          contents: prompt,
        })
    );

    const text = response.text?.trim();
    if (!text) throw new Error("Gemini retornou resposta vazia ao refinar legenda.");
    return text;
  },
};
