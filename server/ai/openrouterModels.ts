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
  {
    id: "deepseek/deepseek-chat-v3-0324:free",
    label: "DeepSeek V3 0324 (free, só texto)",
    description: "Refinamento e copywriting. Sem visão.",
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

/** Ordem de tentativa para tarefas com foto quando o modelo escolhido falha. */
export const OPENROUTER_VISION_FALLBACK_CHAIN = [
  "openrouter/free",
  "qwen/qwen2.5-vl-32b-instruct:free",
  "google/gemini-2.0-flash-exp:free",
  "mistralai/mistral-small-3.2-24b-instruct:free",
] as const;

export function buildOpenRouterVisionModelChain(primaryModel: string): string[] {
  const primary = sanitizeOpenRouterModelId(primaryModel) ?? primaryModel;
  const chain: string[] = [];
  const meta = getOpenRouterModelOption(primary);
  if (meta?.vision && primary) chain.push(primary);
  for (const id of OPENROUTER_VISION_FALLBACK_CHAIN) {
    if (!chain.includes(id)) chain.push(id);
  }
  return chain;
}

export function isOpenRouterRetryableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /no endpoints found|resposta vazia|indisponível no OpenRouter|429|rate.?limit|502|503|timeout|temporarily unavailable/i.test(
    msg
  );
}
