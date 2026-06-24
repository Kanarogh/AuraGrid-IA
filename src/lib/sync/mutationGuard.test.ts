import assert from "node:assert/strict";
import {
  beginSyncDomain,
  endSyncDomain,
  isSyncDomainBusy,
  isSyncPullPaused,
} from "./mutationGuard";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok: ${name}`);
  } catch (err) {
    console.error(`  FAIL: ${name}`);
    throw err;
  }
}

console.log("mutationGuard");

test("nested begin/end tracks busy state", () => {
  beginSyncDomain("catalog");
  beginSyncDomain("catalog");
  assert.equal(isSyncDomainBusy("catalog"), true);
  assert.equal(isSyncPullPaused("catalog"), true);
  endSyncDomain("catalog");
  assert.equal(isSyncDomainBusy("catalog"), true);
  endSyncDomain("catalog");
  assert.equal(isSyncDomainBusy("catalog"), false);
});

test("domains are independent", () => {
  beginSyncDomain("workspace");
  assert.equal(isSyncPullPaused("catalog"), false);
  assert.equal(isSyncPullPaused("workspace"), true);
  endSyncDomain("workspace");
});

console.log("mutationGuard: all passed");
