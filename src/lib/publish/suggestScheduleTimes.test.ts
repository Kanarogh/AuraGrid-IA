import assert from "node:assert/strict";
import { suggestScheduleTimes, calendarDateForPost } from "./suggestScheduleTimes";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok: ${name}`);
  } catch (err) {
    console.error(`  FAIL: ${name}`);
    throw err;
  }
}

console.log("publish/suggestScheduleTimes");

test("calendarDateForPost computes date from startDate and dayNumber", () => {
  assert.equal(calendarDateForPost("2024-06-01", 1), "2024-06-01");
  assert.equal(calendarDateForPost("2024-06-01", 3), "2024-06-03");
});

test("suggestScheduleTimes applies 1 slot for 1 post per day", () => {
  const out = suggestScheduleTimes({
    startDate: "2024-06-01",
    posts: [{ postId: "a", dayNumber: 1 }],
  });
  assert.equal(out.length, 1);
  assert.equal(out[0].timeLabel, "10:00");
  assert.ok(out[0].scheduledAt.includes("2024-06-01T10:00:00"));
});

test("suggestScheduleTimes applies 2 slots for 2 posts same day", () => {
  const out = suggestScheduleTimes({
    startDate: "2024-06-01",
    posts: [
      { postId: "a", dayNumber: 2 },
      { postId: "b", dayNumber: 2 },
    ],
  });
  assert.equal(out.length, 2);
  assert.equal(out[0].timeLabel, "10:00");
  assert.equal(out[1].timeLabel, "18:00");
});

test("suggestScheduleTimes applies 3 slots for 3 posts same day", () => {
  const out = suggestScheduleTimes({
    startDate: "2024-06-01",
    posts: [
      { postId: "a", dayNumber: 5 },
      { postId: "b", dayNumber: 5 },
      { postId: "c", dayNumber: 5 },
    ],
  });
  assert.deepEqual(
    out.map((s) => s.timeLabel),
    ["09:00", "14:00", "19:00"]
  );
});

console.log("\nAll suggestScheduleTimes tests passed.");
