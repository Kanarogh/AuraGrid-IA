const CHANNEL_NAME = "auragrid-catalog";

type CatalogChangedMessage = {
  type: "catalog-changed";
  clientId: string;
  revision?: string;
};

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  if (!channel) channel = new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

export function broadcastCatalogChanged(clientId: string, revision?: string): void {
  const payload: CatalogChangedMessage = {
    type: "catalog-changed",
    clientId,
    revision,
  };
  getChannel()?.postMessage(payload);
}

export function subscribeCatalogChanged(
  handler: (clientId: string, revision?: string) => void
): () => void {
  const ch = getChannel();
  if (!ch) return () => {};

  const onMessage = (event: MessageEvent<CatalogChangedMessage>) => {
    const data = event.data;
    if (data?.type === "catalog-changed" && data.clientId) {
      handler(data.clientId, data.revision);
    }
  };

  ch.addEventListener("message", onMessage);
  return () => ch.removeEventListener("message", onMessage);
}
