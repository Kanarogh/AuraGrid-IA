import assert from "node:assert/strict";
import { SYNC_NOTIFY_CHANNEL, parseSyncEventPayload } from "./syncEvents";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok: ${name}`);
  } catch (err) {
    console.error(`  FAIL: ${name}`);
    throw err;
  }
}

console.log("syncEvents");

test("channel name is stable", () => {
  assert.equal(SYNC_NOTIFY_CHANNEL, "auragrid_sync");
});

test("parseSyncEventPayload accepts valid payload", () => {
  const payload = parseSyncEventPayload(
    JSON.stringify({
      v: 1,
      ownerUserId: "user1",
      clientId: "clientA",
      domains: ["workspace"],
      periodId: "pp1",
    })
  );
  assert.ok(payload);
  assert.deepEqual(payload!.domains, ["workspace"]);
});

test("parseSyncEventPayload rejects invalid", () => {
  assert.equal(parseSyncEventPayload("{}"), null);
  assert.equal(parseSyncEventPayload("not-json"), null);
});

console.log("syncEvents: all passed");
