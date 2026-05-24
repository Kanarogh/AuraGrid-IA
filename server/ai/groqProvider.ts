import {
  buildMatchCaptionInstructions,
  buildRefineCaptionPrompt,
  resolveBrandGemFromBody,
} from "./brandContext.ts";
import { getGroqModel, hasGroqKey } from "./config.ts";
import { CATALOG_PROFILE_JSON_SCHEMA, MATCH_RESULT_JSON_SCHEMA } from "./schemas.ts";
import { annotateErrorWithRetryAfter, toDataUrl, withRetry } from "./shared.ts";
import type {
  AiProvider,
  CatalogEnrichInput,
  MatchGenerateInput,
  MatchGenerateResult,
} from "./types.ts";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

type GroqMessage = {
  role: "system" | "user" | "assistant";
  content: string | GroqContentPart[];
};

type GroqContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

function getApiKey() {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) throw new Error("GROQ_API_KEY não configurada no .env");
  return apiKey;
}

async function groqChat(
  messages: GroqMessage[],
  options: {
    jsonSchema?: { name: string; schema: Record<string, unknown> };
    maxTokens?: number;
  } = {}
): Promise<string> {
  const body: Record<string, unknown> = {
    model: getGroqModel(),
    messages,
    temperature: 0.2,
    max_tokens: options.maxTokens ?? 4096,
  };

  if (options.jsonSchema) {
    body.response_format = {
      type: "json_schema",
      json_schema: {
        name: options.jsonSchema.name,
        schema: options.jsonSchema.schema,
      },
    };
  }

  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  let data: {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`Groq retornou resposta inválida (HTTP ${res.status}).`);
  }

  if (!res.ok) {
    const msg = data.error?.message || raw.slice(0, 300) || `HTTP ${res.status}`;
    throw annotateErrorWithRetryAfter(new Error(msg), res);
  }

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Groq retornou resposta vazia.");
  return content;
}

const ENRICH_PROMPT = (label: string, id: string) => `You are a senior fashion catalog analyst for an Indian/Madrid boutique.
Analyze this garment reference photo exhaustively. The wholesale reference code is "${label || "unknown"}" (catalog id: ${id || "n/a"}).

Create a structured visual profile JSON that another AI will use LATER to match a social media post image against this catalog WITHOUT seeing this photo again.
Be extremely specific about colors, pattern, neckline, sleeves, dress length, silhouette, fabric, embellishments, and unique details.

Set referenceLabel to the provided label. Set version to 1.
distinguishingFingerprint: ONE sentence with the most unique visual identifiers.
matchKeywords: 8-15 short lowercase tokens.`;

export const groqProvider: AiProvider = {
  id: "groq",
  getModel: getGroqModel,
  isConfigured: hasGroqKey,

  async enrichCatalogItem({ image, label, id }: CatalogEnrichInput) {
    const content = await withRetry(
      () =>
        groqChat(
          [
            {
              role: "user",
              content: [
                { type: "text", text: ENRICH_PROMPT(label, id) },
                { type: "image_url", image_url: { url: toDataUrl(image) } },
              ],
            },
          ],
          {
            jsonSchema: {
              name: "catalog_visual_profile",
              schema: CATALOG_PROFILE_JSON_SCHEMA as unknown as Record<string, unknown>,
            },
          }
        ),
      "Groq"
    );

    const profile = JSON.parse(content) as Record<string, unknown>;
    if (profile.version !== 1) profile.version = 1;
    if (!profile.referenceLabel) profile.referenceLabel = label || "unknown";
    return profile;
  },

  async matchAndGenerate(input: MatchGenerateInput): Promise<MatchGenerateResult> {
    const { postImage, catalogItems, catalogProfiles } = input;
    const gem = resolveBrandGemFromBody(input);

    const profiles = Array.isArray(catalogProfiles) ? catalogProfiles : [];
    const useTextCatalog =
      profiles.length > 0 && profiles.every((p) => p?.profile);

    const content: GroqContentPart[] = [];

    if (useTextCatalog) {
      content.push({
        type: "text",
        text: `You are an expert AI fashion planner for boutique 'Palak' (Madrid).

TASK:
1. Inspect the TARGET POST IMAGE below.
2. Compare against CANDIDATE CATALOG PROFILES (JSON).
3. Pick the best matching catalog id, or null if none match confidently.
4. Write an elite Spanish Instagram/Facebook caption.

RULES:
- matchedId MUST be an exact candidate "id" or null.
- reasoning in Portuguese, 2-4 sentences with visual evidence.

TARGET POST IMAGE:`,
      });
      content.push({ type: "image_url", image_url: { url: toDataUrl(postImage) } });
      content.push({
        type: "text",
        text: `CANDIDATE CATALOG PROFILES:\n${JSON.stringify(
          profiles.map((p) => ({ id: p.id, label: p.label, ...p.profile })),
          null,
          2
        )}`,
      });
    } else {
      content.push({
        type: "text",
        text: `You are an expert fashion planner for boutique Palak (Madrid).
Compare the target post image to candidate catalog photos. Pick matchedId or null. Write Spanish caption.

Target post image:`,
      });
      content.push({ type: "image_url", image_url: { url: toDataUrl(postImage) } });

      if (catalogItems && catalogItems.length > 0) {
        const maxImages = 4;
        const slice = catalogItems.slice(0, maxImages);
        if (catalogItems.length > maxImages) {
          content.push({
            type: "text",
            text: `(Mostrando ${maxImages} de ${catalogItems.length} candidatos — prefira IDs visíveis.)`,
          });
        }
        slice.forEach((item, idx) => {
          content.push({
            type: "text",
            text: `[CANDIDATE #${idx + 1}] ID: "${item.id}" Label: "${item.label}"`,
          });
          content.push({ type: "image_url", image_url: { url: toDataUrl(item.image) } });
        });
      } else {
        content.push({ type: "text", text: "No catalog candidates — matchedId null." });
      }
    }

    content.push({
      type: "text",
      text: buildMatchCaptionInstructions(gem),
    });

    const raw = await withRetry(
      () =>
        groqChat([{ role: "user", content }], {
          jsonSchema: {
            name: "match_and_caption",
            schema: MATCH_RESULT_JSON_SCHEMA as unknown as Record<string, unknown>,
          },
        }),
      "Groq"
    );

    const parsed = JSON.parse(raw) as Omit<MatchGenerateResult, "matchMode"> & {
      matchedId?: string | null;
    };
    const mid = parsed.matchedId;
    const matchedId =
      mid && mid !== "null" && mid !== "none" && mid.trim() !== "" ? mid : null;
    return {
      ...parsed,
      matchedId,
      matchMode: useTextCatalog ? "catalog_json" : "catalog_images",
    };
  },

  async refineCaption(input) {
    const { currentCaption, instructions } = input;
    const gem = resolveBrandGemFromBody(input);
    return withRetry(
      () =>
        groqChat([
          {
            role: "user",
            content: buildRefineCaptionPrompt(currentCaption, instructions, gem),
          },
        ]),
      "Groq"
    );
  },
};
