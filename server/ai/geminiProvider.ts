import { GoogleGenAI, Type } from "@google/genai";
import {
  buildRefineCaptionPrompt,
  resolveBrandGemFromBody,
} from "./brandContext.ts";
import {
  buildMatchJsonCatalogTask,
  buildMatchImagesCatalogTask,
  buildCatalogProfilesPromptSection,
  buildMatchResultInstructions,
  buildImageOnlyCaptionTask,
  buildImageOnlyResultInstructions,
  isImageOnlyCaptionMode,
  normalizeMatchedId,
  resolveMatchedIdFromCandidates,
} from "./matchPrompts.ts";
import { buildEnrichCatalogPrompt, finalizeCatalogProfile } from "./catalogProfile.ts";
import { CATALOG_PROFILE_SCHEMA } from "../geminiShared.ts";
import { getGeminiModel, hasGeminiKey } from "./config.ts";
import { cleanBase64, withRetry } from "./shared.ts";
import type {
  AiProvider,
  CatalogEnrichInput,
  MatchGenerateInput,
  MatchGenerateResult,
} from "./types.ts";

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
  getModel: getGeminiModel,
  isConfigured: hasGeminiKey,

  async enrichCatalogItem({ image, label, id }: CatalogEnrichInput) {
    const ai = getClient();
    const model = getGeminiModel();

    const response = await withRetry(
      () =>
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
        }),
      "Gemini"
    );

    const rawText = response.text?.trim();
    if (!rawText) throw new Error("Gemini retornou resposta vazia.");

    const profile = JSON.parse(rawText) as Record<string, unknown>;
    return finalizeCatalogProfile(profile, label);
  },

  async matchAndGenerate(input: MatchGenerateInput): Promise<MatchGenerateResult> {
    const ai = getClient();
    const model = getGeminiModel();
    const { postImage, catalogItems, catalogProfiles, matchOnly, regenerateCaption } = input;
    const gem = resolveBrandGemFromBody(input);

    if (isImageOnlyCaptionMode(input)) {
      const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [
        { text: buildImageOnlyCaptionTask(gem) },
        { inlineData: cleanBase64(postImage) },
        {
          text: buildImageOnlyResultInstructions(gem, {
            regenerate: !!regenerateCaption,
          }),
        },
      ];

      const response = await withRetry(
        () =>
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
          }),
        "Gemini"
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
        text: `\n${buildCatalogProfilesPromptSection(profiles)}`,
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
      text: buildMatchResultInstructions(gem, !!matchOnly, {
        regenerate: !!regenerateCaption,
      }),
    });

    const response = await withRetry(
      () =>
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
        }),
      "Gemini"
    );

    const parsed = JSON.parse(response.text || "{}") as Omit<MatchGenerateResult, "matchMode"> & {
      caption?: string;
    };
    const candidateIds = useTextCatalog
      ? profiles.map((p) => p.id)
      : (catalogItems ?? []).map((c) => c.id);
    return {
      matchedId: resolveMatchedIdFromCandidates(parsed.matchedId, candidateIds),
      reasoning: parsed.reasoning ?? "",
      caption: matchOnly ? "" : (parsed.caption ?? ""),
      matchMode: useTextCatalog ? "catalog_json" : "catalog_images",
    };
  },

  async refineCaption(input) {
    const { currentCaption, instructions } = input;
    const gem = resolveBrandGemFromBody(input);
    const ai = getClient();
    const prompt = buildRefineCaptionPrompt(currentCaption, instructions, gem);

    const response = await withRetry(
      () =>
        ai.models.generateContent({
          model: getGeminiModel(),
          contents: prompt,
        }),
      "Gemini"
    );

    const text = response.text?.trim();
    if (!text) throw new Error("Gemini retornou resposta vazia ao refinar legenda.");
    return text;
  },
};
