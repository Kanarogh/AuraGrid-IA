import {
  buildMatchCaptionInstructions,
  buildRefineCaptionPrompt,
  resolveBrandGemFromBody,
} from "./brandContext.ts";
import { getOpenRouterModel, hasOpenRouterKey } from "./config.ts";
import {
  buildOpenRouterVisionModelChain,
  isOpenRouterRetryableError,
} from "./openrouterModels.ts";
import { CATALOG_PROFILE_JSON_SCHEMA, MATCH_RESULT_JSON_SCHEMA } from "./schemas.ts";
import { logAiAttemptFail, logAiAttemptOk } from "./diagnostics.ts";
import { annotateErrorWithRetryAfter, toDataUrl, withRetry } from "./shared.ts";
import type {
  AiProvider,
  CatalogEnrichInput,
  MatchGenerateInput,
  MatchGenerateResult,
} from "./types.ts";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

type ORMessage = {
  role: "system" | "user" | "assistant";
  content: string | ORContentPart[];
};

type ORContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

function getApiKey() {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENROUTER_API_KEY não configurada no .env");
  return apiKey;
}

function getAppUrl() {
  return process.env.APP_URL?.trim() || "http://localhost:3000";
}

function extractMessageContent(message: Record<string, unknown> | undefined): string {
  if (!message) return "";
  const content = message.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const p = part as Record<string, unknown>;
      if (typeof p.text === "string" && p.text.trim()) parts.push(p.text.trim());
      if (typeof p.content === "string" && p.content.trim()) parts.push(p.content.trim());
    }
    if (parts.length) return parts.join("\n").trim();
  }
  if (typeof message.reasoning === "string" && message.reasoning.trim()) {
    return message.reasoning.trim();
  }
  if (typeof message.refusal === "string" && message.refusal.trim()) {
    return message.refusal.trim();
  }
  return "";
}

function describeMessageShape(message: Record<string, unknown> | undefined): string {
  if (!message) return "sem message";
  const keys = Object.keys(message);
  const content = message.content;
  let contentHint: string = typeof content;
  if (Array.isArray(content)) {
    const types = content
      .map((p) =>
        p && typeof p === "object" && "type" in p ? String((p as { type?: string }).type) : "?"
      )
      .join(",");
    contentHint = `array[${types}]`;
  }
  return `keys=${keys.join(",")} content=${contentHint}`;
}

/**
 * Alguns modelos free do OpenRouter (Llama 3.2 Vision) não suportam
 * response_format JSON Schema. Nestes casos, instruímos o modelo via prompt
 * a devolver JSON e parseamos manualmente.
 */
function modelSupportsJsonSchema(model: string): boolean {
  if (model === "openrouter/free") return false;
  if (/llama-3\.2.*vision/i.test(model)) return false;
  if (/qwen.*vl/i.test(model)) return false;
  return true;
}

async function openrouterChat(
  messages: ORMessage[],
  options: {
    jsonSchema?: { name: string; schema: Record<string, unknown> };
    maxTokens?: number;
  } = {},
  modelOverride?: string
): Promise<string> {
  const model = modelOverride ?? getOpenRouterModel();
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: 0.2,
    max_tokens: options.maxTokens ?? 4096,
  };

  if (options.jsonSchema && modelSupportsJsonSchema(model)) {
    body.response_format = {
      type: "json_schema",
      json_schema: {
        name: options.jsonSchema.name,
        schema: options.jsonSchema.schema,
        strict: true,
      },
    };
  }

  const res = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
      "HTTP-Referer": getAppUrl(),
      "X-Title": "AuraGrid",
    },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  let data: {
    model?: string;
    choices?: {
      message?: Record<string, unknown>;
      finish_reason?: string;
    }[];
    error?: { message?: string; code?: number };
  };
  try {
    data = JSON.parse(raw);
  } catch {
    const err = new Error(`OpenRouter retornou resposta inválida (HTTP ${res.status}).`);
    logAiAttemptFail("openrouter-chat", "openrouter", err, {
      model,
      httpStatus: res.status,
      detail: raw.slice(0, 400),
    });
    throw err;
  }

  const routedModel = data.model;
  const choice = data.choices?.[0];
  const finishReason = choice?.finish_reason;

  if (!res.ok) {
    const msg = data.error?.message || raw.slice(0, 300) || `HTTP ${res.status}`;
    if (/no endpoints found/i.test(msg)) {
      const err = new Error(`Modelo "${model}" indisponível no OpenRouter.`);
      logAiAttemptFail("openrouter-chat", "openrouter", err, {
        model,
        httpStatus: res.status,
        routedModel,
        detail: msg,
      });
      throw err;
    }
    const err = annotateErrorWithRetryAfter(new Error(msg), res);
    logAiAttemptFail("openrouter-chat", "openrouter", err, {
      model,
      httpStatus: res.status,
      routedModel,
      detail: msg,
    });
    throw err;
  }

  const content = extractMessageContent(choice?.message);
  if (!content) {
    const shape = describeMessageShape(choice?.message);
    const err = new Error(
      `OpenRouter retornou resposta vazia (pedido: ${model}, roteado: ${routedModel ?? "?"}). ` +
        `Não é cota — o modelo free respondeu sem texto (${shape}). ` +
        `Tente "Qwen 2.5 VL 32B" no painel IA.`
    );
    logAiAttemptFail("openrouter-chat", "openrouter", err, {
      model,
      httpStatus: res.status,
      routedModel,
      finishReason,
      detail: `${shape} | body: ${raw.slice(0, 600)}`,
    });
    throw err;
  }

  if (routedModel && routedModel !== model) {
    console.info(`[OpenRouter] pedido=${model} → roteado=${routedModel}`);
  }

  return content;
}

async function openrouterChatVision(
  messages: ORMessage[],
  options: {
    jsonSchema?: { name: string; schema: Record<string, unknown> };
    maxTokens?: number;
  } = {}
): Promise<{ content: string; modelUsed: string }> {
  const models = buildOpenRouterVisionModelChain(getOpenRouterModel());
  const errors: string[] = [];

  console.info(`[OpenRouter] cadeia visão: ${models.join(" → ")}`);

  for (const model of models) {
    try {
      const content = await openrouterChat(messages, options, model);
      logAiAttemptOk("openrouter-vision", "openrouter", model, `modelo usado: ${model}`);
      if (model !== getOpenRouterModel()) {
        console.info(`[OpenRouter] visão OK com fallback: ${model}`);
      }
      return { content, modelUsed: model };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${model}: ${msg}`);
      if (!isOpenRouterRetryableError(err)) throw err;
    }
  }

  throw new Error(
    `OpenRouter: todos os modelos de visão falharam.\n${errors.join("\n")}\n` +
      `Tente mais tarde ou configure créditos em openrouter.ai.`
  );
}

/** Extrai o primeiro JSON válido de uma string que pode conter prosa/markdown. */
function extractJson(content: string): string {
  const trimmed = content.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return trimmed;

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) return fenceMatch[1].trim();

  const objMatch = trimmed.match(/\{[\s\S]*\}/);
  if (objMatch) return objMatch[0];

  return trimmed;
}

const ENRICH_PROMPT = (label: string, id: string) => `You are a senior fashion catalog analyst for an Indian/Madrid boutique.
Analyze this garment reference photo exhaustively. The wholesale reference code is "${label || "unknown"}" (catalog id: ${id || "n/a"}).

Create a structured visual profile JSON that another AI will use LATER to match a social media post image against this catalog WITHOUT seeing this photo again.
Be extremely specific about colors, pattern, neckline, sleeves, dress length, silhouette, fabric, embellishments, and unique details.

Set referenceLabel to the provided label. Set version to 1.
distinguishingFingerprint: ONE sentence with the most unique visual identifiers.
matchKeywords: 8-15 short lowercase tokens.

RESPOND WITH PURE JSON ONLY (no prose, no markdown fences). The JSON must follow this shape:
{
  "version": 1,
  "referenceLabel": "${label || "unknown"}",
  "category": "...",
  "primaryColor": "...",
  "secondaryColors": ["..."],
  "pattern": "...",
  "neckline": "...",
  "sleeves": "...",
  "length": "...",
  "silhouette": "...",
  "fabric": "...",
  "embellishments": ["..."],
  "uniqueDetails": ["..."],
  "distinguishingFingerprint": "...",
  "matchKeywords": ["..."]
}`;

const MATCH_RESPONSE_HINT = `RESPOND WITH PURE JSON ONLY (no prose, no markdown fences). The JSON must follow:
{
  "matchedId": "string-or-null",
  "reasoning": "...",
  "caption": "..."
}`;

export const openrouterProvider: AiProvider = {
  id: "openrouter",
  getModel: getOpenRouterModel,
  isConfigured: hasOpenRouterKey,

  async enrichCatalogItem({ image, label, id }: CatalogEnrichInput) {
    const { content } = await withRetry(
      () =>
        openrouterChatVision(
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
      "OpenRouter"
    );

    const profile = JSON.parse(extractJson(content)) as Record<string, unknown>;
    if (profile.version !== 1) profile.version = 1;
    if (!profile.referenceLabel) profile.referenceLabel = label || "unknown";
    return profile;
  },

  async matchAndGenerate(input: MatchGenerateInput): Promise<MatchGenerateResult> {
    const { postImage, catalogItems, catalogProfiles } = input;
    const gem = resolveBrandGemFromBody(input);

    const profiles = Array.isArray(catalogProfiles) ? catalogProfiles : [];
    const useTextCatalog = profiles.length > 0 && profiles.every((p) => p?.profile);

    const content: ORContentPart[] = [];

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
            text: `(Showing ${maxImages} of ${catalogItems.length} candidates — prefer visible IDs.)`,
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
      text: `${buildMatchCaptionInstructions(gem)}\n\n${MATCH_RESPONSE_HINT}`,
    });

    const { content: raw } = await withRetry(
      () =>
        openrouterChatVision([{ role: "user", content }], {
          jsonSchema: {
            name: "match_and_caption",
            schema: MATCH_RESULT_JSON_SCHEMA as unknown as Record<string, unknown>,
          },
        }),
      "OpenRouter"
    );

    const parsed = JSON.parse(extractJson(raw)) as Omit<MatchGenerateResult, "matchMode"> & {
      matchedId?: string | null;
    };
    const mid = parsed.matchedId;
    const matchedId =
      mid && mid !== "null" && mid !== "none" && String(mid).trim() !== "" ? mid : null;
    return {
      matchedId,
      reasoning: parsed.reasoning ?? "",
      caption: parsed.caption ?? "",
      matchMode: useTextCatalog ? "catalog_json" : "catalog_images",
    };
  },

  async refineCaption(input) {
    const { currentCaption, instructions } = input;
    const gem = resolveBrandGemFromBody(input);
    return withRetry(
      () =>
        openrouterChat([
          {
            role: "user",
            content: buildRefineCaptionPrompt(currentCaption, instructions, gem),
          },
        ]),
      "OpenRouter"
    );
  },
};
