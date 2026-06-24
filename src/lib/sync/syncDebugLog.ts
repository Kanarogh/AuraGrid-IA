export type SyncDebugEvent =
  | "sse.open"
  | "sse.revision"
  | "sse.enrich"
  | "sse.error"
  | "sse.reconnect"
  | "sync.schedule"
  | "sync.start"
  | "sync.skip"
  | "sync.echo"
  | "sync.diff"
  | "sync.apply"
  | "sync.done"
  | "sync.fail"
  | "broadcast.in"
  | "tokens.refresh"
  | "save.skip"
  | "save.patch";

type SyncDebugPayload = Record<string, unknown>;

function isEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const flag = process.env.NEXT_PUBLIC_SYNC_DEBUG;
  if (flag === "1" || flag === "true") return true;
  if (flag === "0" || flag === "false") return false;
  return process.env.NODE_ENV !== "production";
}

export function syncDebugLog(
  event: SyncDebugEvent,
  payload?: SyncDebugPayload
): void {
  if (!isEnabled()) return;
  const ts = new Date().toISOString().slice(11, 23);
  if (payload && Object.keys(payload).length) {
    console.info(`[AuraGrid:sync] ${ts} ${event}`, payload);
  } else {
    console.info(`[AuraGrid:sync] ${ts} ${event}`);
  }
}
