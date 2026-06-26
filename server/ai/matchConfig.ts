/** Flags de otimização do pipeline de match (tokens). */

function envFlag(name: string, defaultOn = true): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  if (v === undefined || v === "") return defaultOn;
  return v === "1" || v === "true" || v === "yes";
}

export function isMatchRankerFastPathEnabled(): boolean {
  return envFlag("MATCH_RANKER_FAST_PATH", true);
}

export function isMatchTextOnlyEnabled(): boolean {
  return envFlag("MATCH_TEXT_ONLY", true);
}

export function isMatchTextOnlyFallbackVisionEnabled(): boolean {
  return envFlag("MATCH_TEXT_ONLY_FALLBACK_VISION", true);
}

/** Quando o match por visão (foto do post) escolhe ref. mas validação só-JSON rejeita, manter a visão. */
export function isMatchTrustVisionOnRejectEnabled(): boolean {
  return envFlag("MATCH_TRUST_VISION_ON_REJECT", true);
}

export function isMatchEmbeddingEnabled(): boolean {
  return envFlag("MATCH_EMBEDDING_ENABLED", true);
}

export function getMatchEmbeddingTopK(): number {
  const raw = process.env.MATCH_EMBEDDING_TOP_K?.trim();
  const n = raw ? Number.parseInt(raw, 10) : 24;
  return Number.isFinite(n) && n >= 4 ? Math.min(n, 80) : 24;
}

export function getGeminiEmbeddingModel(): string {
  return process.env.GEMINI_EMBEDDING_MODEL?.trim() || "gemini-embedding-2";
}

export const GEMINI_EMBEDDING_DIMENSIONS = 768;

export type MatchStrategy = "ranker-fast" | "text-only" | "vision-legacy" | "image-only" | "known-reference";
