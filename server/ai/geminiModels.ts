/** Modelos Google Gemini utilizáveis no AuraGrid (texto + visão, curadoria jun/2026). */

export type GeminiModelOption = {
  id: string;
  label: string;
  description: string;
  /** Match, legenda com foto, fingerprint, refinar. */
  vision: boolean;
  /** Bom para indexação JSON do catálogo em lote. */
  forCatalog?: boolean;
  recommended?: boolean;
};

export const GEMINI_MODELS: GeminiModelOption[] = [
  {
    id: "gemini-3.5-flash",
    label: "Gemini 3.5 Flash",
    description:
      "Recomendado — mais recente e estável. Forte em planejamento, match visual, legendas e cronograma.",
    vision: true,
    recommended: true,
  },
  {
    id: "gemini-3.1-flash-lite",
    label: "Gemini 3.1 Flash Lite",
    description:
      "Recomendado para indexar catálogo — mais rápido e econômico da família 3.x, com visão.",
    vision: true,
    forCatalog: true,
    recommended: true,
  },
  {
    id: "gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro (preview)",
    description:
      "Máxima qualidade da série 3.x — ideal para legendas e refino exigentes. Preview: pode mudar.",
    vision: true,
  },
  {
    id: "gemini-3-flash-preview",
    label: "Gemini 3 Flash (preview)",
    description:
      "Flash com inteligência de nível Pro — bom equilíbrio para testes em planejamento e referência.",
    vision: true,
  },
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    description:
      "Estável e comprovado — match visual, legenda com foto e refinar. Boa opção de fallback.",
    vision: true,
  },
  {
    id: "gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash Lite",
    description:
      "Estável e econômico — indexação de catálogo em lote com boa cota no tier free.",
    vision: true,
    forCatalog: true,
  },
  {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    description: "Alta qualidade da série 2.5 — raciocínio avançado, consome mais cota.",
    vision: true,
  },
];

const KNOWN_IDS = new Set(GEMINI_MODELS.map((m) => m.id));

export function sanitizeGeminiModelId(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const id = raw.trim();
  if (KNOWN_IDS.has(id)) return id;
  if (/^gemini-[a-z0-9.-]+$/i.test(id)) return id;
  return null;
}

export function getGeminiModelOption(id: string): GeminiModelOption | undefined {
  return GEMINI_MODELS.find((m) => m.id === id);
}
