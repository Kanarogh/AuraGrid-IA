import type { SyncDomain } from "./types";

const ECHO_WINDOW_MS = 4_000;

type LocalMark = {
  at: number;
  domains: SyncDomain[];
};

const marks = new Map<string, LocalMark>();

function markKey(clientId: string): string {
  return clientId;
}

/** Marca mutação local para ignorar eco SSE/broadcast na mesma sessão. */
export function markLocalSync(clientId: string, domains: SyncDomain[]): void {
  if (!clientId || !domains.length) return;
  marks.set(markKey(clientId), { at: Date.now(), domains: [...new Set(domains)] });
}

export function isLocalSyncEcho(clientId: string, domains: SyncDomain[]): boolean {
  const mark = marks.get(markKey(clientId));
  if (!mark) return false;
  if (Date.now() - mark.at > ECHO_WINDOW_MS) {
    marks.delete(markKey(clientId));
    return false;
  }
  if (!domains.length) return true;
  return domains.every((d) => mark.domains.includes(d));
}

export function clearLocalSyncMark(clientId: string): void {
  marks.delete(markKey(clientId));
}
