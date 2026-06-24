import assert from "node:assert/strict";
import { tokensFromSyncRevision } from "./types";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok: ${name}`);
  } catch (err) {
    console.error(`  FAIL: ${name}`);
    throw err;
  }
}

console.log("syncTokens");

test("tokensFromSyncRevision maps revision fields", () => {
  const tokens = tokensFromSyncRevision({
    periodId: "pp_1",
    catalog: {
      revision: "rev_cat",
      itemCount: 0,
      readyCount: 0,
      processingCount: 0,
    },
    workspace: "rev_ws",
    brandGem: "rev_gem",
    periods: "rev_periods",
    registry: "rev_registry",
    clientUpdatedAt: "2026-06-20T12:00:00.000Z",
  });
  assert.deepEqual(tokens, {
    catalog: "rev_cat",
    workspace: "rev_ws",
    brandGem: "rev_gem",
    periods: "rev_periods",
    registry: "rev_registry",
  });
});

console.log("syncTokens: all passed");
