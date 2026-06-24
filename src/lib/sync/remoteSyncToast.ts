import type { SyncDomain } from "./types";
import { SYNC_DOMAIN_LABELS } from "./types";

let lastToastAt = 0;
let lastToastKey = "";

/** Evita spam de toast quando vários NOTIFYs chegam em sequência. */
export function notifyDomainsForToast(domains: SyncDomain[]): SyncDomain[] {
  return domains.filter((d) => d === "registry" || d === "periods");
}

export function shouldShowRemoteSyncToast(domains: SyncDomain[]): boolean {
  const notify = notifyDomainsForToast(domains);
  if (!notify.length) return false;
  const key = notify.slice().sort().join(",");
  const now = Date.now();
  if (key === lastToastKey && now - lastToastAt < 8_000) return false;
  lastToastAt = now;
  lastToastKey = key;
  return true;
}

export function remoteSyncToastMessage(domains: SyncDomain[]): string {
  const notify = notifyDomainsForToast(domains);
  const labels = notify.map((d) => SYNC_DOMAIN_LABELS[d]).join(", ");
  return `Atualizado de outro dispositivo: ${labels}`;
}
