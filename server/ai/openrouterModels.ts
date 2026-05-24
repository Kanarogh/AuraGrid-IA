import { hasOpenRouterKey } from "./config.ts";
import {
  fetchLiveOpenRouterVisionModelIds,
  listLiveOpenRouterModels,
  mergeOpenRouterModelsForUi,
} from "./openrouterModelsLive.ts";
import { filterOpenRouterCatalogVisionModelIds } from "./openrouterVisionFilter.ts";

/**
 * Curadoria de modelos OpenRouter úteis para o AuraGrid.
 *
 * - vision=true: pode analisar fotos (match-and-generate, enrich-catalog).
 * - vision=false: só texto (refineCaption).
 *
 * IDs mudam com frequência no tier free. Use `openrouter/free` para o roteador
 * automático quando um modelo específico retornar "No endpoints found".
 */

export type OpenRouterModelOption = {
  id: string;
  label: string;
  description: string;
  vision: boolean;
  recommended?: boolean;
  /** Presente na API OpenRouter agora (free + visão). */
  availableNow?: boolean;
  source?: "live" | "curated";
  visionText?: boolean;
  visionImage?: boolean;
  isFree?: boolean;
};

/** IDs que deixaram de existir no OpenRouter → substituto. */
export const DEPRECATED_OPENROUTER_MODELS: Record<string, string> = {
  "meta-llama/llama-3.2-11b-vision-instruct:free": "openrouter/free",
  "meta-llama/llama-3.2-90b-vision-instruct:free": "openrouter/free",
  "google/gemini-flash-1.5:free": "google/gemini-2.0-flash-exp:free",
};

export const OPENROUTER_MODELS: OpenRouterModelOption[] = [
  {
    id: "openrouter/free",
    label: "OpenRouter Free (auto)",
    description:
      "Escolhe sozinho um modelo free com visão disponível agora. Melhor quando outros dão “No endpoints found”.",
    vision: true,
    recommended: true,
  },
  {
    id: "google/gemma-4-31b-it:free",
    label: "Gemma 4 31B (free, visão)",
    description:
      "Dense multimodal Google (texto + imagem), 256K contexto. Forte em código, raciocínio e documentos — ótimo para catálogo e legendas.",
    vision: true,
    recommended: true,
  },
  {
    id: "google/gemma-4-26b-a4b-it:free",
    label: "Gemma 4 26B A4B (free, visão)",
    description:
      "MoE Google (3,8B ativos/token): texto, imagem e vídeo curto. Eficiente e estável no tier free da OpenRouter.",
    vision: true,
    recommended: true,
  },
  {
    id: "qwen/qwen2.5-vl-32b-instruct:free",
    label: "Qwen 2.5 VL 32B (free)",
    description: "Visão multimodal, ótimo para descrever looks e match no catálogo.",
    vision: true,
    recommended: true,
  },
  {
    id: "google/gemini-2.0-flash-exp:free",
    label: "Gemini 2.0 Flash exp (free)",
    description: "Visão Google via OpenRouter, bom em PT/ES. Pode esgotar cota no horário de pico.",
    vision: true,
  },
  {
    id: "qwen/qwen2.5-vl-72b-instruct:free",
    label: "Qwen 2.5 VL 72B (free)",
    description: "Visão maior; pode estar indisponível em alguns horários.",
    vision: true,
  },
  {
    id: "mistralai/mistral-small-3.2-24b-instruct:free",
    label: "Mistral Small 3.2 24B (free)",
    description: "Visão e texto, europeu, bom em espanhol.",
    vision: true,
  },
  {
    id: "minimax/minimax-m2.5:free",
    label: "MiniMax M2.5 (free)",
    description:
      "Excelente em legendas ES (só texto). Use para refinar — não envia foto do post.",
    vision: false,
    recommended: true,
  },
  {
    id: "minimax/minimax-m2.7",
    label: "MiniMax M2.7 (pago)",
    description: "Mais capaz que M2.5. Requer créditos OpenRouter. Sem visão.",
    vision: false,
  },
  {
    id: "meta-llama/llama-3.3-70b-instruct:free",
    label: "Llama 3.3 70B (free, só texto)",
    description: "Refinar legenda. Sem visão.",
    vision: false,
  },
];

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

/** Ordem para legendas/match com foto (Gemma 4 free primeiro; roteador por último). */
export const OPENROUTER_VISION_FALLBACK_CHAIN = [
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "qwen/qwen2.5-vl-32b-instruct:free",
  "google/gemini-2.0-flash-exp:free",
  "mistralai/mistral-small-3.2-24b-instruct:free",
  "openrouter/free",
] as const;

/** Indexação do catálogo: Gemma 4 → Qwen → resto; openrouter/free só no fim. */
export const OPENROUTER_CATALOG_ENRICH_CHAIN = [
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "qwen/qwen2.5-vl-32b-instruct:free",
  "qwen/qwen2.5-vl-72b-instruct:free",
  "google/gemini-2.0-flash-exp:free",
  "mistralai/mistral-small-3.2-24b-instruct:free",
  "openrouter/free",
] as const;

export function buildOpenRouterVisionModelChain(
  primaryModel: string,
  mode: "default" | "catalog" = "default"
): string[] {
  const primary = sanitizeOpenRouterModelId(primaryModel) ?? primaryModel;
  const chain: string[] = [];
  const meta = getOpenRouterModelOption(primary);

  if (mode === "catalog") {
    // Sempre tenta o modelo escolhido no painel primeiro (mesmo se saiu da lista curada).
    if (primary && primary !== "openrouter/free" && !chain.includes(primary)) {
      chain.push(primary);
    }
    for (const id of OPENROUTER_CATALOG_ENRICH_CHAIN) {
      if (!chain.includes(id)) chain.push(id);
    }
    if (primary === "openrouter/free" && !chain.includes("openrouter/free")) {
      chain.unshift("openrouter/free");
    }
    return chain;
  }

  if (meta?.vision && primary) chain.push(primary);
  for (const id of OPENROUTER_VISION_FALLBACK_CHAIN) {
    if (!chain.includes(id)) chain.push(id);
  }
  return chain;
}

/** Catálogo: modelo do painel → IDs live da API OpenRouter → lista fixa. */
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

  if (primary === "openrouter/free" && !chain.includes("openrouter/free")) {
    chain.unshift("openrouter/free");
  }

  return chain;
}

export function isOpenRouterRetryableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /no endpoints found|resposta vazia|indisponível no OpenRouter|perfil json incompleto|incompletecatalogprofile|provider returned error|upstream|bad gateway|overloaded|429|rate.?limit|502|503|504|timeout|temporarily unavailable/i.test(
    msg
  );
}

/** Na indexação do catálogo, tenta todos os modelos da cadeia exceto falha de autenticação. */
export function shouldTryNextCatalogVisionModel(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (/401|403|invalid.*key|unauthorized|OPENROUTER_API_KEY/i.test(msg)) return false;
  return true;
}
