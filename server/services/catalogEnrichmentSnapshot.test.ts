import assert from "node:assert/strict";
import {
  buildCatalogEnrichmentSnapshot,
  deriveEnrichProgressFromSnapshot,
  findStaleProcessingIds,
  isSnapshotEnriching,
  STALE_PROCESSING_MS,
  type CatalogItemSnapshot,
} from "./catalogEnrichmentSnapshot";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok: ${name}`);
  } catch (err) {
    console.error(`  FAIL: ${name}`);
    throw err;
  }
}

console.log("catalogEnrichmentSnapshot");

const baseItem = (overrides: Partial<CatalogItemSnapshot> = {}): CatalogItemSnapshot => ({
  id: "item-1",
  label: "9146 Pink",
  isReference: true,
  imageAssetId: "img-1",
  enrichmentStatus: "pending",
  ...overrides,
});

test("buildCatalogEnrichmentSnapshot counts by status", () => {
  const items: CatalogItemSnapshot[] = [
    baseItem({ id: "a", enrichmentStatus: "ready", visualProfile: { x: 1 } }),
    baseItem({ id: "b", enrichmentStatus: "processing" }),
    baseItem({ id: "c", enrichmentStatus: "pending" }),
    baseItem({ id: "d", enrichmentStatus: "failed" }),
    baseItem({ id: "e", isReference: false, enrichmentStatus: "processing" }),
    baseItem({ id: "f", imageAssetId: null, enrichmentStatus: "pending" }),
  ];
  const snap = buildCatalogEnrichmentSnapshot(items);
  assert.equal(snap.readyCount, 1);
  assert.equal(snap.processingCount, 1);
  assert.equal(snap.pendingCount, 1);
  assert.equal(snap.failedCount, 1);
  assert.equal(snap.currentItem?.id, "b");
});

test("isSnapshotEnriching when processing items exist", () => {
  const idle = buildCatalogEnrichmentSnapshot([
    baseItem({ enrichmentStatus: "ready", visualProfile: {} }),
  ]);
  assert.equal(isSnapshotEnriching(idle), false);

  const active = buildCatalogEnrichmentSnapshot([
    baseItem({ enrichmentStatus: "processing" }),
  ]);
  assert.equal(isSnapshotEnriching(active), true);
});

test("deriveEnrichProgressFromSnapshot from DB state", () => {
  const snap = buildCatalogEnrichmentSnapshot([
    baseItem({ id: "done", enrichmentStatus: "ready", visualProfile: {} }),
    baseItem({ id: "cur", label: "9146 Pink", enrichmentStatus: "processing" }),
    baseItem({ id: "next", enrichmentStatus: "pending" }),
  ]);
  const progress = deriveEnrichProgressFromSnapshot(snap);
  assert.ok(progress);
  assert.equal(progress!.itemId, "cur");
  assert.equal(progress!.label, "9146 Pink");
  assert.equal(progress!.index, 2);
  assert.equal(progress!.total, 3);
});

test("deriveEnrichProgressFromSnapshot returns null when idle", () => {
  const snap = buildCatalogEnrichmentSnapshot([
    baseItem({ enrichmentStatus: "ready", visualProfile: {} }),
  ]);
  assert.equal(deriveEnrichProgressFromSnapshot(snap), null);
});

test("findStaleProcessingIds respects updatedAt threshold", () => {
  const now = Date.parse("2026-06-20T12:00:00.000Z");
  const fresh = new Date(now - STALE_PROCESSING_MS + 60_000).toISOString();
  const stale = new Date(now - STALE_PROCESSING_MS - 60_000).toISOString();

  const ids = findStaleProcessingIds(
    [
      baseItem({ id: "fresh", enrichmentStatus: "processing", updatedAt: fresh }),
      baseItem({ id: "stale", enrichmentStatus: "processing", updatedAt: stale }),
      baseItem({ id: "no-date", enrichmentStatus: "processing" }),
      baseItem({ id: "ready", enrichmentStatus: "ready" }),
    ],
    STALE_PROCESSING_MS,
    now
  );
  assert.deepEqual(ids.sort(), ["no-date", "stale"]);
});

console.log("catalogEnrichmentSnapshot: all passed");
