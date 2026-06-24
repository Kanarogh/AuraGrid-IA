import type { SyncDomain } from "./types";

export const SYNC_REVISION_DEBOUNCE_MS = 50;
export const SYNC_FALLBACK_POLL_MS = 60_000;
export const SYNC_SSE_RECONNECT_BASE_MS = 1_000;
export const SYNC_SSE_RECONNECT_MAX_MS = 30_000;

export function nextSseReconnectDelay(attempt: number): number {
  const delay = SYNC_SSE_RECONNECT_BASE_MS * 2 ** Math.max(0, attempt - 1);
  return Math.min(delay, SYNC_SSE_RECONNECT_MAX_MS);
}

export function mergeSyncDomains(domains: SyncDomain[]): SyncDomain[] {
  return [...new Set(domains)];
}

export function shouldUseFallbackPoll(sseOpen: boolean): boolean {
  return !sseOpen;
}

/** Toast só para mudanças estruturais — grid/catálogo atualizam silenciosamente. */
export function shouldNotifyRemoteApply(
  domains: SyncDomain[],
  isEnriching: boolean
): boolean {
  if (!domains.length) return false;
  if (isEnriching && domains.every((d) => d === "catalog")) return false;
  return domains.some((d) => d === "registry" || d === "periods");
}
