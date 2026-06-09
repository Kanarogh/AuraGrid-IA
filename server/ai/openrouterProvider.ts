import {
  buildRefineCaptionPrompt,
  resolveBrandGemFromBody,
} from "./brandContext";
import { getOpenRouterModel, hasOpenRouterKey, isAiFallbackAllowed } from "./config";
import {
  buildOpenRouterVisionModelChain,
  getLastSuccessfulCatalogVisionModel,
  getOpenRouterModelOption,
  isOpenRouterRetryableError,
  prioritizeCatalogVisionChain,
  resolveOpenRouterCatalogVisionChain,
  setLastSuccessfulCatalogVisionModel,
  shouldTryNextCatalogVisionModel,
} from "./openrouterModels";
import { buildEnrichCatalogPrompt, finalizeCatalogProfile } from "./catalogProfile";
import {
  buildMatchJsonCatalogTask,
  buildMatchImagesCatalogTask,
  buildCatalogProfilesPromptSection,
  buildMatchResultInstructions,
  buildImageOnlyCaptionTask,
  buildImageOnlyResultInstructions,
  buildCaptionPromptOptions,
  isImageOnlyCaptionMode,
  MATCH_REFERENCE_RESPONSE_HINT,
  MATCH_RESPONSE_HINT,
  normalizeMatchedId,
  resolveMatchedIdFromCandidates,
} from "./matchPrompts";
import {
  CATALOG_PROFILE_JSON_SCHEMA,
  MATCH_REFERENCE_JSON_SCHEMA,
  MATCH_RESULT_JSON_SCHEMA,
} from "./schemas";
import { logAiAttemptFail, logAiAttemptOk } from "./diagnostics";
import {
  buildPostFingerprintPrompt,
  normalizePostFingerprint,
  POST_FINGERPRINT_JSON_SCHEMA,
} from "./postFingerprint";
import { annotateErrorWithRetryAfter, toDataUrl, withRetry } from "./shared";
import type {
  AiProvider,
  CatalogEnrichInput,
  MatchGenerateInput,
  MatchGenerateResult,
} from "./types";

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
  if (/gemma/i.test(model)) return false;
  if (/llama-3\.2.*vision/i.test(model)) return false;
  if (/qwen.*vl/i.test(model)) return false;
  if (/mistral.*small/i.test(model)) return false;
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
    const detail = msg.length > 20 ? msg : raw.slice(0, 500);
    const err = annotateErrorWithRetryAfter(
      new Error(msg === "Provider returned error" ? `OpenRouter (${model}): ${detail}` : msg),
      res
    );
    logAiAttemptFail("openrouter-chat", "openrouter", err, {
      model,
      httpStatus: res.status,
      routedModel,
      detail,
    });
    throw err;
  }

  const content = extractMessageContent(choice?.message);
  if (!content) {
    const shape = describeMessageShape(choice?.message);
    const err = new Error(
      `OpenRouter retornou resposta vazia (pedido: ${model}, roteado: ${routedModel ?? "?"}). ` +
        `Não é cota — o modelo free respondeu sem texto (${shape}). ` +
        `Tente "Gemma 4 31B" no painel IA.`
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
    catalogEnrich?: boolean;
    catalogLabel?: string;
  } = {}
): Promise<{ content: string; modelUsed: string }> {
  const selected = getOpenRouterModel();

  if (!shouldUseOpenRouterVisionChain(selected)) {
    console.info(`[OpenRouter] modelo fixo: ${selected}`);
    try {
      const content = await openrouterChat(messages, options, selected);
      if (options.catalogEnrich) {
        const raw = parseModelJsonContent(content);
        finalizeCatalogProfile(raw, options.catalogLabel);
      }
      logAiAttemptOk("openrouter-vision", "openrouter", selected);
      return { content, modelUsed: selected };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`OpenRouter (${selected}): ${msg}`);
    }
  }

  const baseChain = options.catalogEnrich
    ? await resolveOpenRouterCatalogVisionChain(selected)
    : buildOpenRouterVisionModelChain(selected, "default");
  const models = options.catalogEnrich
    ? prioritizeCatalogVisionChain(baseChain)
    : baseChain;
  const errors: string[] = [];

  const chainReason = isAiFallbackAllowed()
    ? "fallback ligado"
    : "roteador openrouter/free";
  const preferred = options.catalogEnrich ? getLastSuccessfulCatalogVisionModel() : null;
  if (preferred && models[0] === preferred) {
    console.info(`[OpenRouter] reutilizando modelo OK anterior: ${preferred}`);
  } else {
    console.info(`[OpenRouter] cadeia visão (${chainReason}): ${models.join(" → ")}`);
  }

  for (const model of models) {
    try {
      const content = await openrouterChat(messages, options, model);
      if (options.catalogEnrich) {
        const raw = parseModelJsonContent(content);
        finalizeCatalogProfile(raw, options.catalogLabel);
        setLastSuccessfulCatalogVisionModel(model);
      }
      logAiAttemptOk("openrouter-vision", "openrouter", model, `modelo usado: ${model}`);
      if (model !== selected) {
        console.info(`[OpenRouter] visão OK com fallback: ${model}`);
      }
      return { content, modelUsed: model };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${model}: ${msg}`);
      if (options.catalogEnrich && model === getLastSuccessfulCatalogVisionModel()) {
        setLastSuccessfulCatalogVisionModel(null);
      }
      const tryNext = options.catalogEnrich
        ? shouldTryNextCatalogVisionModel(err)
        : isOpenRouterRetryableError(err);
      if (!tryNext) throw err;
      console.warn(`[OpenRouter] ${model} falhou, tentando próximo… (${msg.slice(0, 120)})`);
    }
  }

  throw new Error(
    `OpenRouter: todos os modelos de visão falharam. ${errors.join(" | ")} ` +
      `Os modelos free mudam com frequência — veja https://openrouter.ai/models?output_modalities=text&input_modalities=image ` +
      `ou use créditos em openrouter.ai (cota diária free esgotada?).`
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

function isNonJsonModelResponse(content: string): boolean {
  const t = content.trim();
  if (/^user\s+safety\s*:/i.test(t)) return true;
  if (/^i(?:'m| am) sorry/i.test(t)) return true;
  if (/^i cannot/i.test(t)) return true;
  if (/^content\s+(?:policy|filtered)/i.test(t)) return true;
  if (t.length < 240 && !t.includes("{") && !t.includes("[")) return true;
  return false;
}

function parseModelJsonContent(content: string): Record<string, unknown> {
  if (isNonJsonModelResponse(content)) {
    throw new Error(
      `O modelo retornou texto em vez de JSON (${content.trim().slice(0, 100)}). ` +
        `Escolha outro modelo de visão no painel IA (ex.: Gemma 4 31B ou Qwen 2.5 VL 32B).`
    );
  }
  const jsonStr = extractJson(content);
  try {
    return JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    throw new Error(
      `Resposta do modelo não é JSON válido (${jsonStr.slice(0, 100)}${jsonStr.length > 100 ? "…" : ""}). ` +
        `Escolha outro modelo de visão no painel IA.`
    );
  }
}

/** Cadeia de visão: roteador free, modelos multimodais ou AI_ALLOW_FALLBACK. */
function shouldUseOpenRouterVisionChain(selectedModel: string): boolean {
  if (isAiFallbackAllowed()) return true;
  if (selectedModel === "openrouter/free") return true;
  return getOpenRouterModelOption(selectedModel)?.vision === true;
}

export const openrouterProvider: AiProvider = {
  id: "openrouter",
  getModel: getOpenRouterModel,
  isConfigured: hasOpenRouterKey,

  async analyzePostVisual({ postImage }) {
    const { content } = await withRetry(
      () =>
        openrouterChatVision(
          [
            {
              role: "user",
              content: [
                { type: "text", text: buildPostFingerprintPrompt() },
                { type: "image_url", image_url: { url: toDataUrl(postImage) } },
              ],
            },
          ],
          {
            jsonSchema: {
              name: "post_visual_fingerprint",
              schema: POST_FINGERPRINT_JSON_SCHEMA as unknown as Record<string, unknown>,
            },
          }
        ),
      "OpenRouter"
    );
    return normalizePostFingerprint(parseModelJsonContent(content));
  },

  async enrichCatalogItem({ image, label, id }: CatalogEnrichInput) {
    const prompt = buildEnrichCatalogPrompt(label, id);

    const { content, modelUsed } = await openrouterChatVision(
      [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: toDataUrl(image) } },
          ],
        },
      ],
      {
        jsonSchema: {
          name: "catalog_visual_profile",
          schema: CATALOG_PROFILE_JSON_SCHEMA as unknown as Record<string, unknown>,
        },
        catalogEnrich: true,
        catalogLabel: label,
      }
    );

    const raw = parseModelJsonContent(content);
    const profile = finalizeCatalogProfile(raw, label);
    return { ...profile, __auragridRoutedModel: modelUsed };
  },

  async matchAndGenerate(input: MatchGenerateInput): Promise<MatchGenerateResult> {
    const { postImage, matchOnly, regenerateCaption } = input;
    const catalogProfiles = input.catalogProfiles;
    const catalogItems = input.catalogProfiles?.length ? undefined : input.catalogItems;
    const gem = resolveBrandGemFromBody(input);

    if (isImageOnlyCaptionMode(input)) {
      const content: ORContentPart[] = [
        { type: "text", text: buildImageOnlyCaptionTask(gem) },
        { type: "image_url", image_url: { url: toDataUrl(postImage) } },
        {
          type: "text",
          text: `${buildImageOnlyResultInstructions(gem, buildCaptionPromptOptions(input))}\n\n${MATCH_RESPONSE_HINT}`,
        },
      ];

      const { content: raw } = await withRetry(
        () =>
          openrouterChatVision([{ role: "user", content }], {
            jsonSchema: {
              name: "image_only_caption",
              schema: MATCH_RESULT_JSON_SCHEMA as unknown as Record<string, unknown>,
            },
          }),
        "OpenRouter"
      );

      const parsed = parseModelJsonContent(raw) as Omit<MatchGenerateResult, "matchMode"> & {
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
    const useTextCatalog = profiles.length > 0 && profiles.every((p) => p?.profile);

    const content: ORContentPart[] = [];

    if (useTextCatalog) {
      content.push({
        type: "text",
        text: buildMatchJsonCatalogTask(!!matchOnly, gem),
      });
      content.push({ type: "image_url", image_url: { url: toDataUrl(postImage) } });
      content.push({
        type: "text",
        text: buildCatalogProfilesPromptSection(profiles, {
          matchRankHint: input.matchRankHint,
        }),
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

    const hint = matchOnly ? MATCH_REFERENCE_RESPONSE_HINT : MATCH_RESPONSE_HINT;
    content.push({
      type: "text",
      text: `${buildMatchResultInstructions(gem, !!matchOnly, buildCaptionPromptOptions(input))}\n\n${hint}`,
    });

    const { content: raw } = await withRetry(
      () =>
        openrouterChatVision([{ role: "user", content }], {
          jsonSchema: {
            name: matchOnly ? "match_reference" : "match_and_caption",
            schema: (matchOnly
              ? MATCH_REFERENCE_JSON_SCHEMA
              : MATCH_RESULT_JSON_SCHEMA) as unknown as Record<string, unknown>,
          },
        }),
      "OpenRouter"
    );

    const parsed = parseModelJsonContent(raw) as Omit<MatchGenerateResult, "matchMode"> & {
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
