export type GeminiPricing = {
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
};

const PRICING_BY_PREFIX: Array<{ prefix: string; pricing: GeminiPricing }> = [
  { prefix: "gemini-3.5-flash", pricing: { inputPerMillionUsd: 1.5, outputPerMillionUsd: 9 } },
  { prefix: "gemini-3.1-flash-lite", pricing: { inputPerMillionUsd: 0.25, outputPerMillionUsd: 1.5 } },
  { prefix: "gemini-3-flash-preview", pricing: { inputPerMillionUsd: 0.5, outputPerMillionUsd: 3 } },
  { prefix: "gemini-2.5-flash-lite", pricing: { inputPerMillionUsd: 0.1, outputPerMillionUsd: 0.4 } },
  { prefix: "gemini-2.5-flash", pricing: { inputPerMillionUsd: 0.3, outputPerMillionUsd: 2.5 } },
  { prefix: "gemini-2.5-pro", pricing: { inputPerMillionUsd: 1.25, outputPerMillionUsd: 10 } },
];

export function getGeminiPricing(model: string): GeminiPricing | null {
  const lower = model.trim().toLowerCase();
  const hit = PRICING_BY_PREFIX.find((item) => lower.startsWith(item.prefix));
  return hit?.pricing ?? null;
}

export function estimateGeminiCostMicros(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = getGeminiPricing(model);
  if (!pricing) return 0;
  const micros = inputTokens * pricing.inputPerMillionUsd + outputTokens * pricing.outputPerMillionUsd;
  return Math.max(0, Math.round(micros));
}
