import assert from "node:assert/strict";
import { classifyPeriodsRemoteChange, parsePeriodsToken } from "./periodsRevision";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok: ${name}`);
  } catch (err) {
    console.error(`  FAIL: ${name}`);
    throw err;
  }
}

console.log("periodsRevision");

test("parsePeriodsToken splits token parts", () => {
  assert.deepEqual(parsePeriodsToken("pp_1:2026-06-20T12:00:00.000Z:3"), {
    activeId: "pp_1",
    maxUpdatedAt: "2026-06-20T12:00:00.000Z",
    count: 3,
  });
});

test("count increase is listOnly", () => {
  const prev = "pp_1:2026-06-20T12:00:00.000Z:2";
  const next = "pp_2:2026-06-20T13:00:00.000Z:3";
  assert.equal(classifyPeriodsRemoteChange(prev, next), "listOnly");
});

test("activeId change with same count is activeSwitch", () => {
  const prev = "pp_1:2026-06-20T12:00:00.000Z:3";
  const next = "pp_2:2026-06-20T12:00:00.000Z:3";
  assert.equal(classifyPeriodsRemoteChange(prev, next), "activeSwitch");
});

test("maxUpdatedAt only is listOnly", () => {
  const prev = "pp_1:2026-06-20T12:00:00.000Z:3";
  const next = "pp_1:2026-06-20T13:00:00.000Z:3";
  assert.equal(classifyPeriodsRemoteChange(prev, next), "listOnly");
});

console.log("periodsRevision: all passed");
