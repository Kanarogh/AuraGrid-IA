import type { SyncDomain } from "./types";

const counts = new Map<SyncDomain, number>();

export function beginSyncDomain(domain: SyncDomain): void {
  counts.set(domain, (counts.get(domain) ?? 0) + 1);
}

export function endSyncDomain(domain: SyncDomain): void {
  const next = Math.max(0, (counts.get(domain) ?? 0) - 1);
  if (next === 0) counts.delete(domain);
  else counts.set(domain, next);
}

export function isSyncDomainBusy(domain: SyncDomain): boolean {
  return (counts.get(domain) ?? 0) > 0;
}

export function isSyncPullPaused(domain: SyncDomain): boolean {
  return isSyncDomainBusy(domain);
}

/** Compatibilidade com código legado do catálogo. */
export function beginCatalogMutation(): void {
  beginSyncDomain("catalog");
}

export function endCatalogMutation(): void {
  endSyncDomain("catalog");
}

export function isCatalogMutationInFlight(): boolean {
  return isSyncDomainBusy("catalog");
}
