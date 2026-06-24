import { apiFetch } from "./api/apiClient";

export const CATALOG_THUMB_WIDTH = 480;
const MAX_CONCURRENT = 6;

const blobCache = new Map<string, string>();
let inFlight = 0;

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

export function catalogMediaDisplayUrl(
  src: string,
  variant: "thumb" | "full" = "thumb"
): string {
  const path = mediaPathFromSrc(src);
  if (!path) return src;
  if (variant === "full") return path;
  return `${path}?w=${CATALOG_THUMB_WIDTH}`;
}

function enqueue(url: string, priority: number): Promise<string> {
  const cached = blobCache.get(url);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve, reject) => {
    queue.push({ url, priority, resolve, reject });
    queue.sort((a, b) => b.priority - a.priority);
    pumpQueue();
  });
}

function pumpQueue(): void {
  while (inFlight < MAX_CONCURRENT && queue.length > 0) {
    const job = queue.shift()!;
    inFlight += 1;

    void apiFetch(job.url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        const objectUrl = URL.createObjectURL(blob);
        blobCache.set(job.url, objectUrl);
        job.resolve(objectUrl);
      })
      .catch(job.reject)
      .finally(() => {
        inFlight -= 1;
        pumpQueue();
      });
  }
}

/** Carrega mídia da API com fila limitada e cache em memória (blob URLs). */
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
