/**
 * Fila global de chamadas à IA — serial, com gap mínimo entre requisições.
 * Evita sobreposição (causa de "uma vai, outra não") e dá visibilidade ao
 * usuário ("Na fila: 3 à frente").
 */

const MIN_GAP_MS = 1500;

export type AiQueueState = {
  inFlight: { id: string; label: string; startedAt: number } | null;
  pending: { id: string; label: string }[];
  lastFinishedAt: number | null;
  totalProcessed: number;
};

type QueueItem<T> = {
  id: string;
  label: string;
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
};

let counter = 0;
const queue: QueueItem<unknown>[] = [];
let inFlight: QueueItem<unknown> | null = null;
let inFlightStartedAt = 0;
let lastFinishedAt: number | null = null;
let totalProcessed = 0;
const listeners = new Set<(state: AiQueueState) => void>();

function snapshot(): AiQueueState {
  return {
    inFlight: inFlight
      ? { id: inFlight.id, label: inFlight.label, startedAt: inFlightStartedAt }
      : null,
    pending: queue.map((q) => ({ id: q.id, label: q.label })),
    lastFinishedAt,
    totalProcessed,
  };
}

function notify() {
  const state = snapshot();
  listeners.forEach((l) => {
    try {
      l(state);
    } catch (err) {
      console.error("aiQueue listener error", err);
    }
  });
}

async function pump() {
  if (inFlight) return;
  const next = queue.shift();
  if (!next) {
    notify();
    return;
  }

  if (lastFinishedAt !== null) {
    const gap = Date.now() - lastFinishedAt;
    if (gap < MIN_GAP_MS) {
      await new Promise((r) => setTimeout(r, MIN_GAP_MS - gap));
    }
  }

  inFlight = next;
  inFlightStartedAt = Date.now();
  notify();

  try {
    const result = await next.fn();
    next.resolve(result);
  } catch (err) {
    next.reject(err);
  } finally {
    inFlight = null;
    lastFinishedAt = Date.now();
    totalProcessed += 1;
    notify();
    void pump();
  }
}

export const aiQueue = {
  enqueue<T>(label: string, fn: () => Promise<T>): Promise<T> {
    counter += 1;
    const id = `ai-${counter}`;
    return new Promise<T>((resolve, reject) => {
      queue.push({
        id,
        label,
        fn: fn as () => Promise<unknown>,
        resolve: resolve as (v: unknown) => void,
        reject,
      });
      notify();
      void pump();
    });
  },

  cancelPending(predicate?: (label: string) => boolean) {
    const keep: QueueItem<unknown>[] = [];
    const drop: QueueItem<unknown>[] = [];
    while (queue.length > 0) {
      const item = queue.shift()!;
      if (!predicate || predicate(item.label)) {
        drop.push(item);
      } else {
        keep.push(item);
      }
    }
    queue.push(...keep);
    drop.forEach((d) => d.reject(new Error("Cancelado pelo usuário")));
    notify();
  },

  getState(): AiQueueState {
    return snapshot();
  },

  subscribe(listener: (state: AiQueueState) => void): () => void {
    listeners.add(listener);
    listener(snapshot());
    return () => {
      listeners.delete(listener);
    };
  },
};
