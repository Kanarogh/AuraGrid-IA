import { hasOpenRouterKey } from "./config";
import {
  fetchLiveOpenRouterVisionModelIds,
  listLiveOpenRouterModels,
  mergeOpenRouterModelsForUi,
} from "./openrouterModelsLive";
import { filterOpenRouterCatalogVisionModelIds } from "./openrouterVisionFilter";

/**
 * Curadoria OpenRouter (jun/2026) — IDs verificados no tier free com visão/texto.
 *
 * - vision=true: indexação, match, legenda com imagem, buscar referência
 * - vision=false: refinar legenda (só texto)
 */

export type OpenRouterModelOption = {
  id: string;
  label: string;
  description: string;
  vision: boolean;
  recommended?: boolean;
  availableNow?: boolean;
  source?: "live" | "curated";
  visionText?: boolean;
  visionImage?: boolean;
  isFree?: boolean;
};

/** IDs rotacionados fora do tier free → substituto atual. */
export const DEPRECATED_OPENROUTER_MODELS: Record<string, string> = {
  "meta-llama/llama-3.2-11b-vision-instruct:free": "google/gemma-4-31b-it:free",
  "meta-llama/llama-3.2-90b-vision-instruct:free": "google/gemma-4-31b-it:free",
  "google/gemini-flash-1.5:free": "google/gemma-4-31b-it:free",
  "google/gemini-2.0-flash-exp:free": "google/gemma-4-31b-it:free",
  "qwen/qwen2.5-vl-32b-instruct:free": "google/gemma-4-31b-it:free",
  "qwen/qwen2.5-vl-72b-instruct:free": "google/gemma-4-31b-it:free",
  "mistralai/mistral-small-3.2-24b-instruct:free": "google/gemma-4-31b-it:free",
  "minimax/minimax-m2.5:free": "meta-llama/llama-3.3-70b-instruct:free",
};

export const OPENROUTER_MODELS: OpenRouterModelOption[] = [
  {
    id: "google/gemma-4-31b-it:free",
    label: "Gemma 4 31B (free, visão)",
    description:
      "Recomendado — melhor qualidade free para catálogo, match e legendas com foto (jun/2026).",
    vision: true,
    recommended: true,
  },
  {
    id: "google/gemma-4-26b-a4b-it:free",
    label: "Gemma 4 26B A4B (free, visão)",
    description: "MoE Google multimodal — fallback eficiente após o 31B.",
    vision: true,
    recommended: true,
  },
  {
    id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    label: "Nemotron 3 Nano Omni 30B (free, visão)",
    description: "NVIDIA multimodal com raciocínio — bom para JSON de catálogo.",
    vision: true,
    recommended: true,
  },
  {
    id: "nvidia/nemotron-nano-12b-v2-vl:free",
    label: "Nemotron Nano 12B VL (free, visão)",
    description: "Visão leve e rápida — útil quando Gemma/Nemotron 30B falham.",
    vision: true,
  },
  {
    id: "moonshotai/kimi-k2.6:free",
    label: "Kimi K2.6 (free, visão)",
    description: "Moonshot multimodal free — reforço na cadeia de fallback.",
    vision: true,
  },
  {
    id: "openrouter/free",
    label: "OpenRouter Free (auto)",
    description:
      "Roteador automático — use só como rede de segurança após os modelos acima.",
    vision: true,
  },
  {
    id: "meta-llama/llama-3.3-70b-instruct:free",
    label: "Llama 3.3 70B (free, só texto)",
    description: "Refinar legenda — sem visão.",
    vision: false,
    recommended: true,
  },
  {
    id: "nvidia/nemotron-3-super-120b-a12b:free",
    label: "Nemotron 3 Super 120B (free, só texto)",
    description: "Alta qualidade, contexto longo — refinar legendas.",
    vision: false,
    recommended: true,
  },
  {
    id: "openai/gpt-oss-120b:free",
    label: "GPT-OSS 120B (free, só texto)",
    description: "Reforço para refinamento de legendas.",
    vision: false,
  },
];

/** Cadeia de visão (qualidade decrescente) — jun/2026. */
export const OPENROUTER_VISION_FALLBACK_CHAIN = [
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "nvidia/nemotron-nano-12b-v2-vl:free",
  "moonshotai/kimi-k2.6:free",
  "openrouter/free",
] as const;

/** Indexação do catálogo — mesma ordem; openrouter/free por último. */
export const OPENROUTER_CATALOG_ENRICH_CHAIN = OPENROUTER_VISION_FALLBACK_CHAIN;

/** Refinar legenda (só texto) — jun/2026. */
export const OPENROUTER_TEXT_FALLBACK_CHAIN = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "openai/gpt-oss-120b:free",
] as const;

/** Modelos cuja reutilização entre itens do lote é segura (qualidade de JSON). */
const CATALOG_BATCH_REUSE_MODELS = new Set<string>([
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
]);

export function sanitizeOpenRouterModelId(id: string | null): string | null {
  if (!id) return null;
  const trimmed = id.trim();
  return DEPRECATED_OPENROUTER_MODELS[trimmed] ?? trimmed;
}

export function getOpenRouterModelOption(id: string): OpenRouterModelOption | undefined {
  const resolved = sanitizeOpenRouterModelId(id) ?? id;
  return OPENROUTER_MODELS.find((m) => m.id === resolved);
}

export function isKnownOpenRouterModel(id: string): boolean {
  const resolved = sanitizeOpenRouterModelId(id) ?? id;
  return OPENROUTER_MODELS.some((m) => m.id === resolved);
}

export function buildOpenRouterVisionModelChain(
  primaryModel: string,
  mode: "default" | "catalog" = "default"
): string[] {
  const primary = sanitizeOpenRouterModelId(primaryModel) ?? primaryModel;
  const chain: string[] = [];
  const meta = getOpenRouterModelOption(primary);
  const baseChain =
    mode === "catalog" ? OPENROUTER_CATALOG_ENRICH_CHAIN : OPENROUTER_VISION_FALLBACK_CHAIN;

  if (primary && primary !== "openrouter/free" && !chain.includes(primary)) {
    chain.push(primary);
  }
  for (const id of baseChain) {
    if (!chain.includes(id)) chain.push(id);
  }
  return chain;
}

/** Último modelo de alta qualidade que indexou com sucesso — reutilizado no próximo item do lote. */
let lastSuccessfulCatalogVisionModel: string | null = null;

export function getLastSuccessfulCatalogVisionModel(): string | null {
  return lastSuccessfulCatalogVisionModel;
}

export function setLastSuccessfulCatalogVisionModel(model: string | null): void {
  if (model !== null && !CATALOG_BATCH_REUSE_MODELS.has(model)) {
    return;
  }
  lastSuccessfulCatalogVisionModel = model;
}

/** Novo lote de indexação: sempre tenta Gemma 31B primeiro de novo. */
export function resetCatalogVisionBatchCache(): void {
  lastSuccessfulCatalogVisionModel = null;
}

/** Só promove modelo anterior se for de qualidade suficiente (evita herdar Nemotron 12B fraco). */
export function prioritizeCatalogVisionChain(chain: string[]): string[] {
  const preferred = lastSuccessfulCatalogVisionModel;
  if (!preferred || !CATALOG_BATCH_REUSE_MODELS.has(preferred)) return chain;
  if (!chain.includes(preferred)) return [preferred, ...chain];
  return [preferred, ...chain.filter((m) => m !== preferred)];
}

/** Catálogo: primário do painel → IDs live filtrados → cadeia curada. */
export async function resolveOpenRouterCatalogVisionChain(
  primaryModel: string
): Promise<string[]> {
  const primary = sanitizeOpenRouterModelId(primaryModel) ?? primaryModel;
  const chain: string[] = [];

  if (primary && primary !== "openrouter/free") chain.push(primary);

  if (hasOpenRouterKey()) {
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (apiKey) {
      const live = await fetchLiveOpenRouterVisionModelIds(apiKey).catch(() => [] as string[]);
      for (const id of filterOpenRouterCatalogVisionModelIds(live)) {
        if (!chain.includes(id)) chain.push(id);
      }
    }
  }

  for (const id of OPENROUTER_CATALOG_ENRICH_CHAIN) {
    if (!chain.includes(id)) chain.push(id);
  }

  return chain;
}

export function isOpenRouterRetryableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /no endpoints found|resposta vazia|indisponível no OpenRouter|perfil json incompleto|incompletecatalogprofile|provider returned error|upstream|bad gateway|overloaded|429|rate.?limit|502|503|504|timeout|temporarily unavailable|não é json|texto em vez de json|user safety|unexpected token/i.test(
    msg
  );
}

export function shouldTryNextCatalogVisionModel(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (/401|403|invalid.*key|unauthorized|OPENROUTER_API_KEY/i.test(msg)) return false;
  return true;
}
