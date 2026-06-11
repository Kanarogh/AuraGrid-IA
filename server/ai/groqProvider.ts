import {
  buildRefineCaptionPrompt,
  resolveBrandGemFromBody,
} from "./brandContext";
import { getGroqModel, hasGroqKey } from "./config";
import { buildEnrichCatalogPrompt, finalizeCatalogProfile } from "./catalogProfile";
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
import {
  CATALOG_PROFILE_JSON_SCHEMA,
  MATCH_REFERENCE_JSON_SCHEMA,
  MATCH_RESULT_JSON_SCHEMA,
} from "./schemas";
import { shrinkVisionImage } from "./imagePayload";
import {
  buildPostFingerprintPrompt,
  normalizePostFingerprint,
  POST_FINGERPRINT_JSON_SCHEMA,
} from "./postFingerprint";
import {
  annotateErrorWithRetryAfter,
  isGroqPayloadTooLarge,
  toDataUrl,
  withRetry,
} from "./shared";
import type {
  AiProvider,
  CaptionOnlyInput,
  CatalogEnrichInput,
  MatchFromFingerprintInput,
  MatchGenerateInput,
  MatchGenerateResult,
} from "./types";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

type GroqMessage = {
  role: "system" | "user" | "assistant";
  content: string | GroqContentPart[];
};

type GroqContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

type GroqPayloadTier = {
  imageMaxSide: number;
  imageQuality: number;
  briefPrompts: boolean;
  ultraProfiles: boolean;
};

const GROQ_MATCH_TIERS: GroqPayloadTier[] = [
  { imageMaxSide: 768, imageQuality: 0.78, briefPrompts: false, ultraProfiles: false },
  { imageMaxSide: 640, imageQuality: 0.72, briefPrompts: true, ultraProfiles: true },
  { imageMaxSide: 512, imageQuality: 0.68, briefPrompts: true, ultraProfiles: true },
];

function pickGroqMatchTiers(profileCount: number): GroqPayloadTier[] {
  if (profileCount >= 40) {
    return [
      { imageMaxSide: 640, imageQuality: 0.72, briefPrompts: true, ultraProfiles: true },
      ...GROQ_MATCH_TIERS.slice(2),
    ];
  }
  if (profileCount >= 28) {
    return GROQ_MATCH_TIERS;
  }
  return GROQ_MATCH_TIERS.slice(0, 2);
}

async function groqVisionImage(dataUrl: string, tier: GroqPayloadTier): Promise<string> {
  return shrinkVisionImage(toDataUrl(dataUrl), {
    maxSide: tier.imageMaxSide,
    quality: tier.imageQuality,
  });
}

async function groqChatWithPayloadTiers<T>(
  tiers: GroqPayloadTier[],
  build: (tier: GroqPayloadTier) => Promise<GroqMessage[]>,
  options: {
    jsonSchema?: { name: string; schema: Record<string, unknown> };
    maxTokens?: number;
  }
): Promise<string> {
  let lastError: unknown;

  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    try {
      const messages = await build(tier);
      return await withRetry(() => groqChat(messages, options), "Groq");
    } catch (err) {
      lastError = err;
      const canShrink = isGroqPayloadTooLarge(err) && i < tiers.length - 1;
      if (!canShrink) throw err;
      console.warn(
        `Groq request too large (tier ${i + 1}/${tiers.length}) — retrying with smaller payload.`
      );
    }
  }

  throw lastError;
}

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

  async analyzePostVisual({ postImage }) {
    const image = await shrinkVisionImage(toDataUrl(postImage), {
      maxSide: 512,
      quality: 0.72,
    });
    const content = await withRetry(
      () =>
        groqChat(
          [
            {
              role: "user",
              content: [
                { type: "text", text: buildPostFingerprintPrompt() },
                { type: "image_url", image_url: { url: image } },
              ],
            },
          ],
          {
            jsonSchema: {
              name: "post_visual_fingerprint",
              schema: POST_FINGERPRINT_JSON_SCHEMA as unknown as Record<string, unknown>,
            },
            maxTokens: 1024,
          }
        ),
      "Groq"
    );
    return normalizePostFingerprint(JSON.parse(content) as Record<string, unknown>);
  },

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
    const { postImage, matchOnly, regenerateCaption } = input;
    const catalogProfiles = input.catalogProfiles;
    const catalogItems = input.catalogProfiles?.length ? undefined : input.catalogItems;
    const gem = resolveBrandGemFromBody(input);

    if (isImageOnlyCaptionMode(input)) {
      const raw = await groqChatWithPayloadTiers(
        GROQ_MATCH_TIERS.slice(0, 2),
        async (tier) => {
          const image = await groqVisionImage(postImage, tier);
          const content: GroqContentPart[] = [
            { type: "text", text: buildImageOnlyCaptionTask(gem) },
            { type: "image_url", image_url: { url: image } },
            {
              type: "text",
              text: buildImageOnlyResultInstructions(
                gem,
                buildCaptionPromptOptions(input, tier.briefPrompts)
              ),
            },
          ];
          return [{ role: "user", content }];
        },
        {
          jsonSchema: {
            name: "image_only_caption",
            schema: MATCH_RESULT_JSON_SCHEMA as unknown as Record<string, unknown>,
          },
        }
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
    const tiers = useTextCatalog
      ? pickGroqMatchTiers(profiles.length)
      : GROQ_MATCH_TIERS.slice(0, 2);

    const raw = await groqChatWithPayloadTiers(
      tiers,
      async (tier) => {
        const content: GroqContentPart[] = [];
        const image = await groqVisionImage(postImage, tier);

        if (useTextCatalog) {
          content.push({
            type: "text",
            text: buildMatchJsonCatalogTask(!!matchOnly, gem),
          });
          content.push({ type: "image_url", image_url: { url: image } });
          content.push({
            type: "text",
            text: buildCatalogProfilesPromptSection(profiles, {
              brief: tier.briefPrompts,
              ultraCompact: tier.ultraProfiles,
              matchRankHint: input.matchRankHint,
            }),
          });
        } else {
          content.push({
            type: "text",
            text: buildMatchImagesCatalogTask(!!matchOnly, gem),
          });
          content.push({ type: "image_url", image_url: { url: image } });

          if (catalogItems && catalogItems.length > 0) {
            const maxImages = tier.briefPrompts ? 3 : 4;
            const slice = catalogItems.slice(0, maxImages);
            if (catalogItems.length > maxImages) {
              content.push({
                type: "text",
                text: `(Mostrando ${maxImages} de ${catalogItems.length} candidatos — prefira IDs visíveis.)`,
              });
            }
            for (const [idx, item] of slice.entries()) {
              const candidateImage = await groqVisionImage(item.image, tier);
              content.push({
                type: "text",
                text: `[CANDIDATE #${idx + 1}] ID: "${item.id}" Label: "${item.label}"`,
              });
              content.push({ type: "image_url", image_url: { url: candidateImage } });
            }
          } else {
            content.push({ type: "text", text: "No catalog candidates — matchedId null." });
          }
        }

        content.push({
          type: "text",
          text: matchOnly
            ? buildMatchResultInstructions(
                gem,
                true,
                buildCaptionPromptOptions(input, tier.briefPrompts)
              )
            : buildMatchResultInstructions(
                gem,
                false,
                buildCaptionPromptOptions(input, tier.briefPrompts)
              ),
        });

        return [{ role: "user", content }];
      },
      {
        jsonSchema: {
          name: matchOnly ? "match_reference" : "match_and_caption",
          schema: (matchOnly
            ? MATCH_REFERENCE_JSON_SCHEMA
            : MATCH_RESULT_JSON_SCHEMA) as unknown as Record<string, unknown>,
        },
      }
    );

    const parsed = JSON.parse(raw) as Omit<MatchGenerateResult, "matchMode"> & {
      matchedId?: string | null;
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
    const tier = GROQ_MATCH_TIERS[0]!;
    const image = await groqVisionImage(input.postImage, tier);
    const raw = await withRetry(
      () =>
        groqChat(
          [
            {
              role: "user",
              content: [
                { type: "text", text: buildCaptionOnlyTask(input, gem) },
                { type: "image_url", image_url: { url: image } },
                {
                  type: "text",
                  text: buildCaptionOnlyResultInstructions(
                    gem,
                    buildCaptionPromptOptions(input)
                  ),
                },
              ],
            },
          ],
          {
            jsonSchema: {
              name: "caption_only",
              schema: {
                type: "object",
                properties: { caption: { type: "string" } },
                required: ["caption"],
              },
            },
          }
        ),
      "Groq"
    );
    const parsed = JSON.parse(raw) as { caption?: string };
    return { caption: parsed.caption ?? "" };
  },

  async matchFromFingerprint(input: MatchFromFingerprintInput): Promise<MatchGenerateResult> {
    const gem = resolveBrandGemFromBody(input);
    const profiles = input.catalogProfiles ?? [];
    const matchOnly = !!input.matchOnly;
    const raw = await withRetry(
      () =>
        groqChat(
          [
            {
              role: "user",
              content: [
                { type: "text", text: buildFingerprintMatchTask(matchOnly, gem) },
                {
                  type: "text",
                  text: buildFingerprintMatchSection(input.postFingerprint, profiles, {
                    matchRankHint: input.matchRankHint,
                    brief: true,
                    ultraCompact: true,
                  }),
                },
                {
                  type: "text",
                  text: buildMatchResultInstructions(
                    gem,
                    matchOnly,
                    buildCaptionPromptOptions(input, true)
                  ),
                },
              ],
            },
          ],
          {
            jsonSchema: {
              name: matchOnly ? "match_reference" : "match_and_caption",
              schema: (matchOnly
                ? MATCH_REFERENCE_JSON_SCHEMA
                : MATCH_RESULT_JSON_SCHEMA) as unknown as Record<string, unknown>,
            },
          }
        ),
      "Groq"
    );
    const parsed = JSON.parse(raw) as Omit<MatchGenerateResult, "matchMode"> & {
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
