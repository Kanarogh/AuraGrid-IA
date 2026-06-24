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
  | "save.patch"
  | "sync.disabled";

type SyncDebugPayload = Record<string, unknown>;

const STORAGE_KEY = "auragrid:sync-debug";
const RELAY_URL = "/api/v1/sync/debug-log";

export function isSyncDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "1" || stored === "true") return true;
    if (stored === "0" || stored === "false") return false;
  } catch {
    /* ignore */
  }

  const flag = process.env.NEXT_PUBLIC_SYNC_DEBUG;
  if (flag === "1" || flag === "true") return true;
  if (flag === "0" || flag === "false") return false;

  return process.env.NODE_ENV !== "production";
}

function relayToTerminal(event: SyncDebugEvent, payload?: SyncDebugPayload): void {
  if (typeof window === "undefined") return;
  try {
    void fetch(RELAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      keepalive: true,
      body: JSON.stringify({ event, payload }),
    });
  } catch {
    /* ignore */
  }
}

export function enableSyncDebug(reload = false): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, "1");
  console.log(
    "[AuraGrid:sync] Debug ON — logs no browser + terminal (se SYNC_DEBUG=1 no servidor)"
  );
  relayToTerminal("sync.start", { phase: "debug-enabled" });
  if (reload) window.location.reload();
}

export function disableSyncDebug(reload = false): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, "0");
  console.log("[AuraGrid:sync] Debug OFF");
  if (reload) window.location.reload();
}

let helpPrinted = false;

export function printSyncDebugHelp(): void {
  if (typeof window === "undefined" || helpPrinted) return;
  helpPrinted = true;

  const on = isSyncDebugEnabled();
  console.log(
    `[AuraGrid:sync] Debug ${on ? "ON" : "OFF"} — browser: __auragridSyncDebug.enable() | terminal: SYNC_DEBUG=1 no servidor + enable()`
  );
}

export function syncDebugLog(
  event: SyncDebugEvent,
  payload?: SyncDebugPayload
): void {
  if (!isSyncDebugEnabled()) return;

  const ts = new Date().toISOString().slice(11, 23);
  const prefix = `[AuraGrid:sync] ${ts} ${event}`;

  if (payload && Object.keys(payload).length) {
    console.log(prefix, payload);
  } else {
    console.log(prefix);
  }

  relayToTerminal(event, payload);
}

if (typeof window !== "undefined") {
  const api = {
    enable: () => enableSyncDebug(true),
    disable: () => disableSyncDebug(true),
    isOn: isSyncDebugEnabled,
  };
  (window as unknown as { __auragridSyncDebug?: typeof api }).__auragridSyncDebug = api;
  printSyncDebugHelp();
}
