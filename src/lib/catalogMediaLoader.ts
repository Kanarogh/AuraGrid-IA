import { apiFetchMedia, getAccessToken } from "./api/apiClient";

export const CATALOG_THUMB_WIDTH = 400;
const MAX_CONCURRENT = 4;
const MAX_RETRIES = 6;

const blobCache = new Map<string, string>();
const inFlight = new Map<string, Promise<string>>();
let activeFetches = 0;
let rateLimitBackoffMs = 0;

type QueueJob = {
  url: string;
  priority: number;
  resolve: (url: string) => void;
  reject: (err: unknown) => void;
};

const queue: QueueJob[] = [];

export function mediaPathFromSrc(src: string): string | null {
  if (src.startsWith("/api/v1/media/")) return src.split("?")[0]!;
  return null;
}

function withAuthQuery(path: string, extra?: Record<string, string>): string {
  const [base, existingQs] = path.split("?");
  const params = new URLSearchParams(existingQs ?? "");
  if (extra) {
    for (const [k, v] of Object.entries(extra)) params.set(k, v);
  }
  const token = getAccessToken();
  if (token) params.set("token", token);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function catalogMediaDisplayUrl(
  src: string,
  variant: "thumb" | "full" = "thumb"
): string {
  const path = mediaPathFromSrc(src);
  if (!path) return src;
  if (variant === "full") return withAuthQuery(path);
  return withAuthQuery(path, { w: String(CATALOG_THUMB_WIDTH) });
}

export function clearCatalogMediaCacheFor(src: string): void {
  const path = mediaPathFromSrc(src);
  if (!path) return;
  for (const variant of ["thumb", "full"] as const) {
    const url = catalogMediaDisplayUrl(path, variant);
    const cached = blobCache.get(url);
    if (cached?.startsWith("blob:")) URL.revokeObjectURL(cached);
    blobCache.delete(url);
    inFlight.delete(url);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchToBlobUrl(url: string, attempt = 0): Promise<string> {
  const cached = blobCache.get(url);
  if (cached) return cached;

  if (rateLimitBackoffMs > 0) {
    await sleep(rateLimitBackoffMs);
  }

  try {
    const res = await apiFetchMedia(url);
    if (!res.ok) {
      if (res.status === 429) {
        rateLimitBackoffMs = Math.min((rateLimitBackoffMs || 300) + 400, 4000);
      }
      const retryable = res.status === 429 || res.status >= 500;
      if (retryable && attempt < MAX_RETRIES) {
        await sleep(600 * (attempt + 1) + rateLimitBackoffMs);
        return fetchToBlobUrl(url, attempt + 1);
      }
      throw new Error(`HTTP ${res.status}`);
    }

    rateLimitBackoffMs = Math.max(0, rateLimitBackoffMs - 200);

    const blob = await res.blob();
    if (!blob.size) throw new Error("blob vazio");

    const objectUrl = URL.createObjectURL(blob);
    blobCache.set(url, objectUrl);
    return objectUrl;
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      await sleep(600 * (attempt + 1));
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
      .then((url) => job.resolve(url))
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
    queue.push({ url, priority, resolve, reject });
    queue.sort((a, b) => b.priority - a.priority);
    pumpQueue();
  });

  inFlight.set(url, promise);
  return promise;
}

async function fetchWithVariants(
  src: string,
  options?: { priority?: number; variant?: "thumb" | "full" }
): Promise<string> {
  const variant = options?.variant ?? "thumb";
  const priority = options?.priority ?? 0;
  const path = mediaPathFromSrc(src) ?? src;

  const primary = catalogMediaDisplayUrl(path, variant);
  try {
    return await enqueue(primary, priority);
  } catch {
    if (variant === "thumb") {
      const full = catalogMediaDisplayUrl(path, "full");
      return enqueue(full, priority + 1);
    }
    throw new Error("falha ao carregar mídia");
  }
}

/** Fallback autenticado (blob) quando `<img src>` direto falha. */
export function requestCatalogMediaUrl(
  src: string,
  options?: { priority?: number; variant?: "thumb" | "full" }
): Promise<string> {
  if (!src) return Promise.reject(new Error("src vazio"));
  if (src.startsWith("data:") || src.startsWith("blob:")) return Promise.resolve(src);
  if (src.startsWith("http://") || src.startsWith("https://")) return Promise.resolve(src);
  return fetchWithVariants(src, options);
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

let preloadTimer: ReturnType<typeof setTimeout> | null = null;
const preloadPending = new Set<string>();

/** Pré-carrega full-res com debounce (hover). */
export function preloadCatalogMedia(src: string, variant: "thumb" | "full" = "full"): void {
  if (!mediaPathFromSrc(src)) return;
  preloadPending.add(src);
  if (preloadTimer) clearTimeout(preloadTimer);
  preloadTimer = setTimeout(() => {
    const batch = [...preloadPending];
    preloadPending.clear();
    for (const item of batch) {
      void requestCatalogMediaUrl(item, { priority: 15, variant });
    }
  }, 200);
}
