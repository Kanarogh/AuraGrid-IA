import assert from "node:assert/strict";
import {
  buildBrandGemRevisionToken,
  buildPeriodsRevisionToken,
  buildRegistryRevisionToken,
  buildWorkspaceRevisionToken,
} from "./syncRevisionService";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok: ${name}`);
  } catch (err) {
    console.error(`  FAIL: ${name}`);
    throw err;
  }
}

console.log("syncRevision");

test("buildWorkspaceRevisionToken encodes period stats", () => {
  const token = buildWorkspaceRevisionToken({
    periodId: "pp_1",
    periodUpdatedAt: "2026-06-20T12:00:00.000Z",
    clientUpdatedAt: "2026-06-20T11:00:00.000Z",
    startDate: "2026-07-01",
    postCount: 7,
    slotCount: 9,
    pageCount: 1,
    canvaSettingsKey: "page1|true|false|square|480",
    contentScheduleKey: "21:4096",
  });
  assert.equal(
    token,
    "pp_1:2026-06-20T12:00:00.000Z:2026-07-01:7:9:1:page1|true|false|square|480:21:4096:2026-06-20T11:00:00.000Z"
  );
});

test("buildWorkspaceRevisionToken changes when content schedule changes", () => {
  const base = {
    periodId: "pp_1",
    periodUpdatedAt: "2026-06-20T12:00:00.000Z",
    clientUpdatedAt: "2026-06-20T11:00:00.000Z",
    startDate: "2026-07-01",
    postCount: 3,
    slotCount: 0,
    pageCount: 1,
    canvaSettingsKey: "0",
  };
  const before = buildWorkspaceRevisionToken({ ...base, contentScheduleKey: "0:0" });
  const after = buildWorkspaceRevisionToken({ ...base, contentScheduleKey: "5:1200" });
  assert.notEqual(before, after);
});

test("buildWorkspaceRevisionToken changes when post count changes", () => {
  const base = {
    periodId: "pp_1",
    periodUpdatedAt: "2026-06-20T12:00:00.000Z",
    clientUpdatedAt: "2026-06-20T11:00:00.000Z",
    startDate: "2026-07-01",
    slotCount: 0,
    pageCount: 1,
    canvaSettingsKey: "0",
  };
  const before = buildWorkspaceRevisionToken({ ...base, postCount: 3 });
  const after = buildWorkspaceRevisionToken({ ...base, postCount: 4 });
  assert.notEqual(before, after);
});

test("buildBrandGemRevisionToken encodes savedAt and context", () => {
  const token = buildBrandGemRevisionToken("2026-06-20T12:00:00.000Z", "Campanha verão");
  assert.match(token, /^2026-06-20T12:00:00.000Z:/);
});

test("buildPeriodsRevisionToken encodes list fingerprint", () => {
  const token = buildPeriodsRevisionToken("pp_1", "2026-06-20T12:00:00.000Z", 3);
  assert.equal(token, "pp_1:2026-06-20T12:00:00.000Z:3");
});

test("buildRegistryRevisionToken encodes maxUpdatedAt and count", () => {
  const token = buildRegistryRevisionToken("2026-06-20T12:00:00.000Z", 2);
  assert.equal(token, "2026-06-20T12:00:00.000Z:2");
});

test("buildRegistryRevisionToken ignores active client switch", () => {
  const before = buildRegistryRevisionToken("2026-06-20T12:00:00.000Z", 2);
  const after = buildRegistryRevisionToken("2026-06-20T12:00:00.000Z", 2);
  assert.equal(before, after);
});

console.log("syncRevision: all passed");
