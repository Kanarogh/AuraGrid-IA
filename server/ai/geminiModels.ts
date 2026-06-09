/** Modelos Google Gemini suportados na API (curadoria jun/2026). */

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
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    description:
      "Recomendado — match visual, legenda com foto e refinar. Melhor equilíbrio qualidade/velocidade.",
    vision: true,
    recommended: true,
  },
  {
    id: "gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash Lite",
    description:
      "Recomendado para indexar catálogo — mais rápido e maior cota no tier free (1.000 req/dia).",
    vision: true,
    forCatalog: true,
    recommended: true,
  },
  {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    description: "Máxima qualidade para match e legendas — consome mais cota.",
    vision: true,
  },
  {
    id: "gemini-2.0-flash",
    label: "Gemini 2.0 Flash",
    description: "Geração anterior — multimodal, ainda suportado.",
    vision: true,
  },
  {
    id: "gemini-2.0-flash-lite",
    label: "Gemini 2.0 Flash Lite",
    description: "Leve — indexação e tarefas simples com visão.",
    vision: true,
    forCatalog: true,
  },
  {
    id: "gemini-1.5-flash",
    label: "Gemini 1.5 Flash",
    description: "Legado estável — visão e texto.",
    vision: true,
  },
  {
    id: "gemini-1.5-pro",
    label: "Gemini 1.5 Pro",
    description: "Legado premium — contexto longo e alta qualidade.",
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
