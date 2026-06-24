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
const recentDispatchKeys = new Map<string, number>();
const DISPATCH_DEDUPE_MS = 300;

function dispatchDedupeKey(payload: SyncEventPayload): string {
  return JSON.stringify(payload);
}

function shouldDispatchPayload(payload: SyncEventPayload): boolean {
  const key = dispatchDedupeKey(payload);
  const now = Date.now();
  const last = recentDispatchKeys.get(key);
  if (last != null && now - last < DISPATCH_DEDUPE_MS) return false;
  recentDispatchKeys.set(key, now);
  if (recentDispatchKeys.size > 200) {
    for (const [k, t] of recentDispatchKeys) {
      if (now - t > DISPATCH_DEDUPE_MS) recentDispatchKeys.delete(k);
    }
  }
  return true;
}

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
  if (!shouldDispatchPayload(payload)) return;

  const enrichProgressOnly =
    payload.enrich?.enriching === true && payload.enrich.progress != null;

  for (const sub of subscribers.values()) {
    if (!matchesSubscriber(sub, payload)) continue;
    if (payload.enrich) {
      sub.send({ type: "enrich", payload });
    }
    if (!enrichProgressOnly) {
      sub.send({ type: "revision", payload });
    }
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
