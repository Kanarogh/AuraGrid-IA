/**
 * Hub in-memory por instância Next.js. NOTIFY do PostgreSQL chega via LISTEN
 * (uma conexão dedicada) e é repassado aos SSE locais.
 *
 * Multi-instância: todas as réplicas LISTEN no mesmo canal; cada uma faz fan-out
 * só para seus próprios subscribers. Se no futuro houver múltiplos DBs, considerar
 * REDIS_URL pub/sub (v2.1).
 */
import { ensureListenChannel } from "../db/listenClient";
import {
  parseSyncEventPayload,
  SYNC_NOTIFY_CHANNEL,
  type SyncEventPayload,
} from "./syncEvents";

export type SseOutboundEvent =
  | { type: "connected" }
  | { type: "revision"; payload: SyncEventPayload }
  | { type: "enrich"; payload: SyncEventPayload };

type Subscriber = {
  id: string;
  userId: string;
  clientId: string;
  periodId: string;
  send: (event: SseOutboundEvent) => void;
};

let nextId = 1;
const subscribers = new Map<string, Subscriber>();
let listenerReady = false;

function matchesSubscriber(sub: Subscriber, payload: SyncEventPayload): boolean {
  if (sub.userId !== payload.ownerUserId) return false;

  if (payload.domains.includes("registry")) {
    return true;
  }

  if (sub.clientId !== payload.clientId) return false;

  if (payload.periodId && sub.periodId && payload.periodId !== sub.periodId) {
    const clientScoped = payload.domains.some((d) => d !== "registry");
    if (clientScoped && !payload.domains.includes("periods")) {
      return false;
    }
  }

  return true;
}

export function dispatchSyncEvent(payload: SyncEventPayload): void {
  for (const sub of subscribers.values()) {
    if (!matchesSubscriber(sub, payload)) continue;
    if (payload.enrich) {
      sub.send({ type: "enrich", payload });
    }
    sub.send({ type: "revision", payload });
  }
}

function onNotify(raw: string): void {
  const payload = parseSyncEventPayload(raw);
  if (payload) dispatchSyncEvent(payload);
}

export async function ensureSyncListener(): Promise<void> {
  if (listenerReady) return;
  await ensureListenChannel(SYNC_NOTIFY_CHANNEL, onNotify);
  listenerReady = true;
}

export function subscribeSyncStream(
  userId: string,
  clientId: string,
  periodId: string,
  send: (event: SseOutboundEvent) => void
): string {
  const id = String(nextId++);
  subscribers.set(id, { id, userId, clientId, periodId, send });
  void ensureSyncListener();
  return id;
}

export function unsubscribeSyncStream(id: string): void {
  subscribers.delete(id);
}

/** Expõe subscribers para testes. */
export function getSyncSubscriberCount(): number {
  return subscribers.size;
}

export function resetSyncEventHubForTests(): void {
  subscribers.clear();
  listenerReady = false;
}
