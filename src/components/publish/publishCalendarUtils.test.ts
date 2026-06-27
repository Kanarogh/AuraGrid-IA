import assert from "node:assert/strict";
import type { PublishQueueItem } from "../../lib/publish/publishApi";
import {
  detectPlanningGaps,
  filterEligibleInVisibleRange,
  findScheduleConflicts,
  getVisibleDateKeys,
} from "./publishCalendarUtils";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok: ${name}`);
  } catch (err) {
    console.error(`  FAIL: ${name}`);
    throw err;
  }
}

function item(partial: Partial<PublishQueueItem> & { plannedPostId: string; dayNumber: number }): PublishQueueItem {
  return {
    jobId: null,
    dateLabel: "Seg",
    caption: "x",
    imageAssetId: "img",
    imageUrl: null,
    isConfirmed: true,
    scheduledAt: null,
    status: "eligible",
    permalink: null,
    lastError: null,
    attempts: 0,
    ...partial,
  };
}

console.log("publish/publishCalendarUtils");

test("detectPlanningGaps marks planning day without schedule", () => {
  const queue = [item({ plannedPostId: "a", dayNumber: 3 })];
  const visible = new Set(["2024-06-03"]);
  const gaps = detectPlanningGaps(queue, "2024-06-01", visible, {});
  assert.equal(gaps.has("2024-06-03"), true);
});

test("detectPlanningGaps clears when draft exists", () => {
  const queue = [item({ plannedPostId: "a", dayNumber: 3 })];
  const visible = new Set(["2024-06-03"]);
  const gaps = detectPlanningGaps(queue, "2024-06-01", visible, {
    a: "2024-06-03T10:00:00-03:00",
  });
  assert.equal(gaps.has("2024-06-03"), false);
});

test("filterEligibleInVisibleRange respects calendar window", () => {
  const eligible = [
    item({ plannedPostId: "a", dayNumber: 3 }),
    item({ plannedPostId: "b", dayNumber: 15 }),
  ];
  const visible = getVisibleDateKeys(new Date(2024, 5, 3), "week");
  const filtered = filterEligibleInVisibleRange(eligible, "2024-06-01", visible);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].plannedPostId, "a");
});

test("findScheduleConflicts detects same minute", () => {
  const a = item({ plannedPostId: "a", dayNumber: 1, status: "eligible" });
  const b = item({ plannedPostId: "b", dayNumber: 2, status: "eligible" });
  const iso = "2024-06-01T10:00:00.000Z";
  const conflicts = findScheduleConflicts([a, b], {
    a: iso,
    b: iso,
  });
  assert.equal(conflicts.size, 1);
});

console.log("\nAll publishCalendarUtils tests passed.");
