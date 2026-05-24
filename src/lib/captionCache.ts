/**
 * Cache LRU em localStorage para resultados de match-and-generate.
 * Evita reprocessar a mesma foto + contexto duas vezes.
 */

const STORAGE_KEY_BASE = "ag.captionCache.v1";
const MAX_ENTRIES = 200;

let activeClientIdForCache = "default";

export function setCaptionCacheClientId(clientId: string) {
  activeClientIdForCache = clientId || "default";
}

function storageKey(): string {
  return `${STORAGE_KEY_BASE}:${activeClientIdForCache}`;
}

export type CaptionCacheValue = {
  caption: string;
  matchedId: string | null;
  reasoning: string | null;
  providerUsed?: string;
  matchMode?: string;
  cachedAt: number;
};

type RepeatingTextInput =
  | string
  | {
      address?: string;
      contact?: string;
      hashtags?: string;
      extra?: string;
    }
  | null
  | undefined;

type BrandGemCacheSlice = {
  name?: string;
  description?: string;
  instructions?: string;
  footer?: RepeatingTextInput;
};

type CaptionCacheKeyInput = {
  imageDataUrl: string;
  brandGem?: BrandGemCacheSlice;
  /** @deprecated use brandGem */
  promptContext?: string;
  repeatingText?: RepeatingTextInput;
  catalogIds?: string[];
};

function serializeRepeating(rep: RepeatingTextInput): string {
  if (!rep) return "";
  if (typeof rep === "string") return rep.trim();
  if (typeof rep === "object" && rep !== null && "structure" in rep) {
    const r = rep as Record<string, unknown>;
    return [r.structure, r.address, r.contact, r.hashtags, r.extra]
      .map((v) => (v ?? "").toString().trim())
      .join("\n");
  }
  return [rep.address, rep.contact, rep.hashtags, rep.extra]
    .map((v) => (v ?? "").toString().trim())
    .join("\n");
}

type StoredEntry = {
  hash: string;
  value: CaptionCacheValue;
  hits: number;
  lastUsed: number;
};

function djb2(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (h * 33) ^ str.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

function fingerprintImage(dataUrl: string): string {
  if (!dataUrl) return "no-image";
  const len = dataUrl.length;
  const head = dataUrl.slice(0, 64);
  const middle = dataUrl.slice(Math.floor(len / 2), Math.floor(len / 2) + 64);
  const tail = dataUrl.slice(-64);
  return `${len}:${djb2(head)}:${djb2(middle)}:${djb2(tail)}`;
}

export function buildCaptionCacheKey(input: CaptionCacheKeyInput): string {
  const imageFp = fingerprintImage(input.imageDataUrl);
  const gem = input.brandGem;
  const name = (gem?.name ?? "").trim();
  const desc = (gem?.description ?? "").trim();
  const ctx = (gem?.instructions ?? input.promptContext ?? "").trim();
  const rep = serializeRepeating(gem?.footer ?? input.repeatingText);
  const ids = (input.catalogIds ?? []).slice().sort().join("|");
  return djb2(`${imageFp}__${name}__${desc}__${ctx}__${rep}__${ids}`);
}

function readAll(): StoredEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e) =>
        e &&
        typeof e.hash === "string" &&
        e.value &&
        typeof e.value.caption === "string"
    );
  } catch {
    return [];
  }
}

function writeAll(entries: StoredEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(), JSON.stringify(entries));
  } catch {
    /* quota cheia ou indisponível: ignora */
  }
}

export function getCachedCaption(hash: string): CaptionCacheValue | null {
  const all = readAll();
  const idx = all.findIndex((e) => e.hash === hash);
  if (idx < 0) return null;
  const entry = all[idx];
  entry.hits += 1;
  entry.lastUsed = Date.now();
  all.splice(idx, 1);
  all.unshift(entry);
  writeAll(all);
  return entry.value;
}

export function setCachedCaption(hash: string, value: CaptionCacheValue) {
  const all = readAll();
  const filtered = all.filter((e) => e.hash !== hash);
  filtered.unshift({
    hash,
    value: { ...value, cachedAt: value.cachedAt || Date.now() },
    hits: 1,
    lastUsed: Date.now(),
  });
  if (filtered.length > MAX_ENTRIES) filtered.length = MAX_ENTRIES;
  writeAll(filtered);
}

export function clearCaptionCache(clientId?: string) {
  if (typeof window === "undefined") return;
  if (clientId) {
    window.localStorage.removeItem(`${STORAGE_KEY_BASE}:${clientId}`);
    return;
  }
  window.localStorage.removeItem(storageKey());
}

export function getCaptionCacheStats() {
  const all = readAll();
  return {
    size: all.length,
    capacity: MAX_ENTRIES,
    totalHits: all.reduce((acc, e) => acc + e.hits, 0),
    oldest: all.length > 0 ? all[all.length - 1].lastUsed : null,
  };
}
