export type CaptionEmojiPolicy = "none" | "minimal" | "moderate" | "free";

export type CaptionHookStyle = "short" | "balanced" | "descriptive";

export interface CaptionGenerationParams {
  /**
   * Limite de caracteres do texto principal (gancho) — NÃO inclui Referência,
   * nota IA, endereço, CTA, hashtags nem campos extras do Gem.
   */
  maxHookChars: number;
  /** @deprecated Mantido só por compatibilidade; teto Instagram fixo 2200 no código */
  maxTotalChars?: number;
  /** Máximo de frases no gancho */
  maxHookSentences: number;
  emojiPolicy: CaptionEmojiPolicy;
  hookStyle: CaptionHookStyle;
  /** Incluir linha Referência quando houver match no catálogo */
  includeReferenceWhenMatched: boolean;
  /** Evitar mencionar preço/valores no gancho */
  avoidPriceMention: boolean;
  /** Tom do gancho comercial */
  salesTone: "soft" | "balanced" | "direct";
}

export const DEFAULT_CAPTION_GENERATION_PARAMS: CaptionGenerationParams = {
  maxHookChars: 500,
  maxHookSentences: 2,
  emojiPolicy: "minimal",
  hookStyle: "balanced",
  includeReferenceWhenMatched: true,
  avoidPriceMention: true,
  salesTone: "balanced",
};

export const CAPTION_EMOJI_POLICY_LABELS: Record<CaptionEmojiPolicy, string> = {
  none: "Sem emojis",
  minimal: "Mínimo (0–1 no gancho)",
  moderate: "Moderado",
  free: "Livre",
};

export const CAPTION_HOOK_STYLE_LABELS: Record<CaptionHookStyle, string> = {
  short: "Curto — 1 frase impactante",
  balanced: "Equilibrado — 1–2 frases",
  descriptive: "Descritivo — detalha tecido/caimento",
};

export const CAPTION_SALES_TONE_LABELS: Record<
  CaptionGenerationParams["salesTone"],
  string
> = {
  soft: "Suave — inspiracional",
  balanced: "Equilibrado",
  direct: "Direto — foco em conversão",
};

/** Teto absoluto Instagram (legenda completa com rodapé). */
export const INSTAGRAM_CAPTION_HARD_MAX = 2200;

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function normalizeCaptionGenerationParams(
  raw?: Partial<CaptionGenerationParams> | null
): CaptionGenerationParams {
  const d = DEFAULT_CAPTION_GENERATION_PARAMS;
  if (!raw) return { ...d };

  const emoji = raw.emojiPolicy;
  const hookStyle = raw.hookStyle;
  const salesTone = raw.salesTone;

  return {
    maxHookChars: clampInt(raw.maxHookChars, 80, 1500, d.maxHookChars),
    maxHookSentences: clampInt(raw.maxHookSentences, 1, 4, d.maxHookSentences),
    emojiPolicy:
      emoji === "none" || emoji === "minimal" || emoji === "moderate" || emoji === "free"
        ? emoji
        : d.emojiPolicy,
    hookStyle:
      hookStyle === "short" || hookStyle === "balanced" || hookStyle === "descriptive"
        ? hookStyle
        : d.hookStyle,
    includeReferenceWhenMatched:
      raw.includeReferenceWhenMatched !== undefined
        ? Boolean(raw.includeReferenceWhenMatched)
        : d.includeReferenceWhenMatched,
    avoidPriceMention:
      raw.avoidPriceMention !== undefined
        ? Boolean(raw.avoidPriceMention)
        : d.avoidPriceMention,
    salesTone:
      salesTone === "soft" || salesTone === "balanced" || salesTone === "direct"
        ? salesTone
        : d.salesTone,
  };
}

/** Estima caracteres dos blocos fixos (fora do gancho) para validação na UI. */
export function estimateFixedBlocksChars(footer: {
  address?: string;
  contact?: string;
  hashtags?: string;
  extra?: string;
  customFields?: { text: string }[];
}): number {
  const parts = [
    footer.extra,
    footer.address,
    footer.contact,
    footer.hashtags,
    ...(footer.customFields?.map((f) => f.text) ?? []),
  ].filter((p) => p?.trim());
  const joined = parts.join("\n\n");
  return joined.length + 60;
}
