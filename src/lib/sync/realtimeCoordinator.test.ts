import assert from "node:assert/strict";
import {
  nextSseReconnectDelay,
  shouldUseFallbackPoll,
  mergeSyncDomains,
} from "./realtimeCoordinator";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok: ${name}`);
  } catch (err) {
    console.error(`  FAIL: ${name}`);
    throw err;
  }
}

console.log("realtimeCoordinator");

test("fallback only when SSE closed", () => {
  assert.equal(shouldUseFallbackPoll(false), true);
  assert.equal(shouldUseFallbackPoll(true), false);
});

test("reconnect backoff caps at 30s", () => {
  assert.equal(nextSseReconnectDelay(1), 1000);
  assert.equal(nextSseReconnectDelay(5), 16000);
  assert.equal(nextSseReconnectDelay(10), 30000);
});

test("mergeSyncDomains dedupes", () => {
  assert.deepEqual(mergeSyncDomains(["workspace", "workspace", "catalog"]), [
    "workspace",
    "catalog",
  ]);
});

console.log("realtimeCoordinator: all passed");
