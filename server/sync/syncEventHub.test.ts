import assert from "node:assert/strict";
import {
  dispatchSyncEvent,
  resetSyncEventHubForTests,
  subscribeSyncStream,
  unsubscribeSyncStream,
} from "./syncEventHub";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok: ${name}`);
  } catch (err) {
    console.error(`  FAIL: ${name}`);
    throw err;
  }
}

console.log("syncEventHub");

test("dispatches workspace to matching client stream", () => {
  resetSyncEventHubForTests();
  const types: string[] = [];
  const id = subscribeSyncStream("user1", "clientA", "pp1", (e) => {
    types.push(e.type);
  });
  dispatchSyncEvent({
    v: 1,
    ownerUserId: "user1",
    clientId: "clientA",
    domains: ["workspace"],
    periodId: "pp1",
  });
  assert.deepEqual(types, ["revision"]);
  unsubscribeSyncStream(id);
});

test("registry reaches all streams of the user", () => {
  resetSyncEventHubForTests();
  let clientB = 0;
  subscribeSyncStream("user1", "clientA", "pp1", (e) => {
    if (e.type === "revision") clientB++;
  });
  subscribeSyncStream("user1", "clientB", "pp2", (e) => {
    if (e.type === "revision") clientB++;
  });
  dispatchSyncEvent({
    v: 1,
    ownerUserId: "user1",
    clientId: "clientX",
    domains: ["registry"],
  });
  assert.equal(clientB, 2);
});

test("enrich emits enrich and revision", () => {
  resetSyncEventHubForTests();
  const types: string[] = [];
  subscribeSyncStream("user1", "clientA", "pp1", (e) => types.push(e.type));
  dispatchSyncEvent({
    v: 1,
    ownerUserId: "user1",
    clientId: "clientA",
    domains: ["catalog"],
    enrich: { enriching: true, progress: { index: 1, total: 3, itemId: "c1", label: "A" } },
  });
  assert.deepEqual(types, ["enrich", "revision"]);
});

console.log("syncEventHub: all passed");
