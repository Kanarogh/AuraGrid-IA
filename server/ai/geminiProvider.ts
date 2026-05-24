import { GoogleGenAI, Type } from "@google/genai";
import {
  buildMatchCaptionInstructions,
  buildRefineCaptionPrompt,
  resolveBrandGemFromBody,
} from "./brandContext.ts";
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

const ENRICH_PROMPT = (label: string, id: string) => `You are a senior fashion catalog analyst for an Indian/Madrid boutique.
Analyze this garment reference photo exhaustively. The wholesale reference code is "${label || "unknown"}" (catalog id: ${id || "n/a"}).

Create a structured visual profile that another AI will use LATER to match a social media post image against this catalog WITHOUT seeing this photo again.
Be extremely specific about: exact colors (primary/secondary), pattern type and scale, neckline shape, sleeve type, dress length, silhouette, fabric appearance, embellishments, and unique details that distinguish this piece from similar dresses.

Set referenceLabel to the provided label. Set version to 1.
distinguishingFingerprint must be ONE sentence listing the most unique visual identifiers.
matchKeywords: 8-15 short lowercase tokens for retrieval.`;

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
          contents: [{ text: ENRICH_PROMPT(label, id) }, { inlineData: cleanBase64(image) }],
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
    if (profile.version !== 1) profile.version = 1;
    if (!profile.referenceLabel) profile.referenceLabel = label || "unknown";
    return profile;
  },

  async matchAndGenerate(input: MatchGenerateInput): Promise<MatchGenerateResult> {
    const ai = getClient();
    const model = getGeminiModel();
    const { postImage, catalogItems, catalogProfiles } = input;
    const gem = resolveBrandGemFromBody(input);

    const profiles = Array.isArray(catalogProfiles) ? catalogProfiles : [];
    const useTextCatalog =
      profiles.length > 0 && profiles.every((p) => p?.profile);

    const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [];

    if (useTextCatalog) {
      parts.push({
        text: `You are an expert AI fashion planner for boutique 'Palak' (Madrid).

TASK:
1. Inspect the TARGET POST IMAGE (the only image you receive).
2. Compare it against CANDIDATE CATALOG PROFILES below (structured JSON — each was pre-analyzed from showroom photos).
3. Pick the single best matching catalog id, or null if none match confidently.
4. Write an elite Spanish Instagram/Facebook caption.

MATCHING RULES (strict):
- matchedId MUST be the exact "id" field of one candidate, or null.
- Only match if pattern, colors, neckline, sleeves, length, and distinctive details align strongly.
- If two candidates are similar, prefer the one whose distinguishingFingerprint best fits the post image.
- reasoning in Portuguese, 2-4 sentences, cite specific visual evidence.

TARGET POST IMAGE:`,
      });
      parts.push({ inlineData: cleanBase64(postImage) });
      parts.push({
        text: `\nCANDIDATE CATALOG PROFILES (JSON array):\n${JSON.stringify(
          profiles.map((p) => ({ id: p.id, label: p.label, ...p.profile })),
          null,
          2
        )}`,
      });
    } else {
      parts.push({
        text: `You are an expert AI fashion planner assistant for a high-end Madrid fashion boutique ('Palak').
Inspect the Target Post Image and compare against candidate catalog photos.
Determine the exact matching item. Write a Spanish caption.

Target post image:`,
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
        parts.push({ text: "\n(No catalog candidates — write caption with matchedId null.)" });
      }
    }

    parts.push({
      text: `${buildMatchCaptionInstructions(gem)}

Output JSON only: { "matchedId": string|null, "reasoning": string (Portuguese), "caption": string }`,
    });

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

    const parsed = JSON.parse(response.text || "{}") as Omit<MatchGenerateResult, "matchMode">;
    return {
      ...parsed,
      matchedId: parsed.matchedId || null,
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
