import { apiFetch } from "./api/apiClient";

export const CATALOG_THUMB_WIDTH = 400;
const MAX_CONCURRENT = 8;
const MAX_RETRIES = 3;

const blobCache = new Map<string, string>();
const inFlight = new Map<string, Promise<string>>();
let activeFetches = 0;

type QueueJob = {
  url: string;
  priority: number;
  retries: number;
  resolve: (url: string) => void;
  reject: (err: unknown) => void;
};

const queue: QueueJob[] = [];

export function mediaPathFromSrc(src: string): string | null {
  if (src.startsWith("/api/v1/media/")) return src.split("?")[0]!;
  return null;
}

export function catalogMediaDisplayUrl(
  src: string,
  variant: "thumb" | "full" = "thumb"
): string {
  const path = mediaPathFromSrc(src);
  if (!path) return src;
  if (variant === "full") return path;
  return `${path}?w=${CATALOG_THUMB_WIDTH}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchToBlobUrl(url: string, attempt = 0): Promise<string> {
  const cached = blobCache.get(url);
  if (cached) return cached;

  try {
    const res = await apiFetch(url);
    if (!res.ok) {
      const retryable = res.status === 429 || res.status >= 500;
      if (retryable && attempt < MAX_RETRIES) {
        await sleep(400 * (attempt + 1));
        return fetchToBlobUrl(url, attempt + 1);
      }
      throw new Error(`HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    blobCache.set(url, objectUrl);
    return objectUrl;
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      await sleep(400 * (attempt + 1));
      return fetchToBlobUrl(url, attempt + 1);
    }
    throw err;
  }
}

function pumpQueue(): void {
  while (activeFetches < MAX_CONCURRENT && queue.length > 0) {
    const job = queue.shift()!;
    activeFetches += 1;

    void fetchToBlobUrl(job.url)
      .then((url) => {
        job.resolve(url);
      })
      .catch(job.reject)
      .finally(() => {
        activeFetches -= 1;
        inFlight.delete(job.url);
        pumpQueue();
      });
  }
}

function enqueue(url: string, priority: number): Promise<string> {
  const cached = blobCache.get(url);
  if (cached) return Promise.resolve(cached);

  const pending = inFlight.get(url);
  if (pending) return pending;

  const promise = new Promise<string>((resolve, reject) => {
    queue.push({ url, priority, retries: 0, resolve, reject });
    queue.sort((a, b) => b.priority - a.priority);
    pumpQueue();
  });

  inFlight.set(url, promise);
  return promise;
}

/** Fallback autenticado (blob) quando `<img src>` direto falha. */
export function requestCatalogMediaUrl(
  src: string,
  options?: { priority?: number; variant?: "thumb" | "full" }
): Promise<string> {
  if (!src) return Promise.reject(new Error("src vazio"));
  if (src.startsWith("data:") || src.startsWith("blob:")) return Promise.resolve(src);
  if (src.startsWith("http://") || src.startsWith("https://")) return Promise.resolve(src);

  const path = mediaPathFromSrc(src) ?? src;
  const url = catalogMediaDisplayUrl(path, options?.variant ?? "thumb");
  return enqueue(url, options?.priority ?? 0);
}

export function peekCatalogMediaUrl(
  src: string,
  variant: "thumb" | "full" = "thumb"
): string | null {
  if (!src) return null;
  const path = mediaPathFromSrc(src);
  if (!path) return null;
  return blobCache.get(catalogMediaDisplayUrl(path, variant)) ?? null;
}

/** Pré-carrega full-res com prioridade alta (hover / lightbox). */
export function preloadCatalogMedia(
  src: string,
  variant: "thumb" | "full" = "full"
): void {
  if (!mediaPathFromSrc(src)) return;
  void requestCatalogMediaUrl(src, { priority: 20, variant });
}
