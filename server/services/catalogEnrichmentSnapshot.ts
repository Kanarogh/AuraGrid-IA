import type { EnrichProgress } from "./enrichQueue";

export type CatalogItemSnapshot = {
  id: string;
  label: string;
  isReference?: boolean;
  imageAssetId?: string | null;
  enrichmentStatus?: string;
  visualProfile?: unknown;
  updatedAt?: string;
};

export type CatalogEnrichmentSnapshot = {
  processingCount: number;
  pendingCount: number;
  readyCount: number;
  failedCount: number;
  incompleteCount: number;
  currentItem: { id: string; label: string } | null;
};

export const STALE_PROCESSING_MS = 10 * 60 * 1000;

export function buildCatalogEnrichmentSnapshot(
  items: CatalogItemSnapshot[]
): CatalogEnrichmentSnapshot {
  const refs = items.filter((i) => i.isReference !== false && i.imageAssetId);
  const incomplete = refs.filter(
    (i) => i.enrichmentStatus !== "ready" || !i.visualProfile
  );
  const processing = refs.filter((i) => i.enrichmentStatus === "processing");
  const pending = refs.filter(
    (i) => i.enrichmentStatus === "pending" || (!i.enrichmentStatus && !i.visualProfile)
  );
  const ready = refs.filter((i) => i.enrichmentStatus === "ready");
  const failed = refs.filter((i) => i.enrichmentStatus === "failed");
  const currentItem = processing[0] ?? null;

  return {
    processingCount: processing.length,
    pendingCount: pending.length,
    readyCount: ready.length,
    failedCount: failed.length,
    incompleteCount: incomplete.length,
    currentItem: currentItem ? { id: currentItem.id, label: currentItem.label } : null,
  };
}

/** Deriva progresso UI quando a fila in-memory não está disponível. */
export function deriveEnrichProgressFromSnapshot(
  snapshot: CatalogEnrichmentSnapshot
): EnrichProgress | null {
  if (!snapshot.currentItem && snapshot.processingCount === 0) return null;

  const total = snapshot.readyCount + snapshot.incompleteCount;
  const index = Math.min(snapshot.readyCount + 1, Math.max(total, 1));
  const item = snapshot.currentItem ?? { id: "", label: "Indexando…" };

  return {
    index,
    total: Math.max(total, index),
    itemId: item.id,
    label: item.label,
  };
}

export function isSnapshotEnriching(snapshot: CatalogEnrichmentSnapshot): boolean {
  return snapshot.processingCount > 0;
}

export function findStaleProcessingIds(
  items: CatalogItemSnapshot[],
  maxAgeMs = STALE_PROCESSING_MS,
  now = Date.now()
): string[] {
  return items
    .filter((i) => i.enrichmentStatus === "processing")
    .filter((i) => {
      if (!i.updatedAt) return true;
      const t = new Date(i.updatedAt).getTime();
      return Number.isNaN(t) || now - t > maxAgeMs;
    })
    .map((i) => i.id);
}
