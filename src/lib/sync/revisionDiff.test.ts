import assert from "node:assert/strict";
import { diffSyncRevisionTokens } from "./revisionDiff";
import type { SyncRevisionTokens } from "./types";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok: ${name}`);
  } catch (err) {
    console.error(`  FAIL: ${name}`);
    throw err;
  }
}

const base: SyncRevisionTokens = {
  catalog: "cat1",
  workspace: "ws1",
  brandGem: "gem1",
  periods: "pp_a:2026-01-01T00:00:00.000Z:2",
  registry: "2026-01-01T00:00:00.000Z:3",
};

console.log("revisionDiff");

test("first poll returns empty diff", () => {
  const result = diffSyncRevisionTokens(null, base, () => false);
  assert.deepEqual(result, { changed: [] });
});

test("detects changed domains", () => {
  const next = { ...base, workspace: "ws2", catalog: "cat2" };
  const result = diffSyncRevisionTokens(base, next, () => false);
  assert.deepEqual(result.changed.sort(), ["catalog", "workspace"]);
});

test("skips paused domains", () => {
  const next = { ...base, workspace: "ws2", catalog: "cat2" };
  const result = diffSyncRevisionTokens(base, next, (d) => d === "workspace");
  assert.deepEqual(result.changed, ["catalog"]);
});

test("periods change includes token context", () => {
  const next = {
    ...base,
    periods: "pp_b:2026-01-02T00:00:00.000Z:2",
  };
  const result = diffSyncRevisionTokens(base, next, () => false);
  assert.deepEqual(result.changed, ["periods"]);
  assert.deepEqual(result.periodTokenChange, {
    prevToken: base.periods,
    nextToken: next.periods,
  });
});

test("registry token format ignores active client switch", () => {
  const sameList = { ...base, registry: "2026-01-01T00:00:00.000Z:3" };
  const result = diffSyncRevisionTokens(base, sameList, () => false);
  assert.deepEqual(result.changed, []);
});

console.log("revisionDiff: all passed");
