import type { SyncDomain } from "./types";

const CHANNEL_NAME = "auragrid-sync";

type SyncChangedMessage = {
  type: "sync-changed";
  clientId: string;
  domains: SyncDomain[];
};

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  if (!channel) channel = new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

export function broadcastSyncChanged(clientId: string, domains: SyncDomain[]): void {
  if (!domains.length) return;
  const payload: SyncChangedMessage = { type: "sync-changed", clientId, domains };
  getChannel()?.postMessage(payload);
}

export function subscribeSyncChanged(
  handler: (clientId: string, domains: SyncDomain[]) => void
): () => void {
  const ch = getChannel();
  if (!ch) return () => {};

  const onMessage = (event: MessageEvent<SyncChangedMessage>) => {
    const data = event.data;
    if (data?.type === "sync-changed" && data.clientId && data.domains?.length) {
      handler(data.clientId, data.domains);
    }
  };

  ch.addEventListener("message", onMessage);
  return () => ch.removeEventListener("message", onMessage);
}

/** @deprecated use broadcastSyncChanged */
export function broadcastCatalogChanged(clientId: string, _revision?: string): void {
  broadcastSyncChanged(clientId, ["catalog"]);
}
