export type ServerSyncDebugEvent =
  | "notify.emit"
  | "notify.skip"
  | "hub.dispatch"
  | "hub.subscriber"
  | "sse.connect"
  | "sse.event"
  | "sse.disconnect"
  | "patch.workspace"
  | "patch.brandgem";

type ServerSyncDebugPayload = Record<string, unknown>;

function isEnabled(): boolean {
  const flag = process.env.SYNC_DEBUG ?? process.env.NEXT_PUBLIC_SYNC_DEBUG;
  if (flag === "1" || flag === "true") return true;
  if (flag === "0" || flag === "false") return false;
  return process.env.NODE_ENV !== "production";
}

export function serverSyncDebugLog(
  event: ServerSyncDebugEvent,
  payload?: ServerSyncDebugPayload
): void {
  if (!isEnabled()) return;
  const ts = new Date().toISOString().slice(11, 23);
  if (payload && Object.keys(payload).length) {
    console.info(`[AuraGrid:sync] ${ts} ${event}`, payload);
  } else {
    console.info(`[AuraGrid:sync] ${ts} ${event}`);
  }
}
