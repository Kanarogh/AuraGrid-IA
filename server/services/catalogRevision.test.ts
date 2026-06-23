import assert from "node:assert/strict";
import { buildCatalogRevisionToken } from "./catalogService";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok: ${name}`);
  } catch (err) {
    console.error(`  FAIL: ${name}`);
    throw err;
  }
}

console.log("catalogRevision");

test("buildCatalogRevisionToken encodes stats", () => {
  const token = buildCatalogRevisionToken({
    maxUpdatedAt: "2026-06-20T12:00:00.000Z",
    itemCount: 12,
    readyCount: 8,
    processingCount: 1,
  });
  assert.equal(token, "2026-06-20T12:00:00.000Z:12:8:1");
});

test("buildCatalogRevisionToken empty catalog", () => {
  const token = buildCatalogRevisionToken({
    maxUpdatedAt: null,
    itemCount: 0,
    readyCount: 0,
    processingCount: 0,
  });
  assert.equal(token, "0:0:0:0");
});

test("revision changes when ready count drops", () => {
  const before = buildCatalogRevisionToken({
    maxUpdatedAt: "2026-06-20T12:00:00.000Z",
    itemCount: 3,
    readyCount: 3,
    processingCount: 0,
  });
  const after = buildCatalogRevisionToken({
    maxUpdatedAt: "2026-06-20T12:05:00.000Z",
    itemCount: 3,
    readyCount: 0,
    processingCount: 0,
  });
  assert.notEqual(before, after);
});

console.log("catalogRevision: all passed");
