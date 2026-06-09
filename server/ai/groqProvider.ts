import {
  buildRefineCaptionPrompt,
  resolveBrandGemFromBody,
} from "./brandContext.ts";
import { getGroqModel, hasGroqKey } from "./config.ts";
import { buildEnrichCatalogPrompt, finalizeCatalogProfile } from "./catalogProfile.ts";
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
import {
  CATALOG_PROFILE_JSON_SCHEMA,
  MATCH_REFERENCE_JSON_SCHEMA,
  MATCH_RESULT_JSON_SCHEMA,
} from "./schemas.ts";
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
                { type: "text", text: buildEnrichCatalogPrompt(label, id) },
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
    return finalizeCatalogProfile(profile, label);
  },

  async matchAndGenerate(input: MatchGenerateInput): Promise<MatchGenerateResult> {
    const { postImage, catalogItems, catalogProfiles, matchOnly, regenerateCaption } = input;
    const gem = resolveBrandGemFromBody(input);

    if (isImageOnlyCaptionMode(input)) {
      const content: GroqContentPart[] = [
        { type: "text", text: buildImageOnlyCaptionTask(gem) },
        { type: "image_url", image_url: { url: toDataUrl(postImage) } },
        {
          type: "text",
          text: buildImageOnlyResultInstructions(gem, { regenerate: !!regenerateCaption }),
        },
      ];

      const raw = await withRetry(
        () =>
          groqChat([{ role: "user", content }], {
            jsonSchema: {
              name: "image_only_caption",
              schema: MATCH_RESULT_JSON_SCHEMA as unknown as Record<string, unknown>,
            },
          }),
        "Groq"
      );

      const parsed = JSON.parse(raw) as Omit<MatchGenerateResult, "matchMode"> & {
        matchedId?: string | null;
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

    const content: GroqContentPart[] = [];

    if (useTextCatalog) {
      content.push({
        type: "text",
        text: buildMatchJsonCatalogTask(!!matchOnly, gem),
      });
      content.push({ type: "image_url", image_url: { url: toDataUrl(postImage) } });
      content.push({
        type: "text",
        text: buildCatalogProfilesPromptSection(profiles),
      });
    } else {
      content.push({
        type: "text",
        text: buildMatchImagesCatalogTask(!!matchOnly, gem),
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
      text: matchOnly
        ? buildMatchResultInstructions(gem, true)
        : buildMatchResultInstructions(gem, false, { regenerate: !!regenerateCaption }),
    });

    const raw = await withRetry(
      () =>
        groqChat([{ role: "user", content }], {
          jsonSchema: {
            name: matchOnly ? "match_reference" : "match_and_caption",
            schema: (matchOnly
              ? MATCH_REFERENCE_JSON_SCHEMA
              : MATCH_RESULT_JSON_SCHEMA) as unknown as Record<string, unknown>,
          },
        }),
      "Groq"
    );

    const parsed = JSON.parse(raw) as Omit<MatchGenerateResult, "matchMode"> & {
      matchedId?: string | null;
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
