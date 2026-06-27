import assert from "node:assert/strict";
import {
  isLegacyPeriodQuery,
  periodIdToUrlSlug,
  periodQueryNeedsCanonicalReplace,
  periodToUrlSlug,
  resolvePeriodQueryToId,
} from "./periodSlug";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok: ${name}`);
  } catch (err) {
    console.error(`  FAIL: ${name}`);
    throw err;
  }
}

const periods = [
  {
    id: "sisaut__period_default",
    startDate: "2026-06-01",
    status: "active" as const,
  },
  {
    id: "sisaut__period_archived",
    startDate: "2026-05-01",
    status: "archived" as const,
  },
];

console.log("appRouting/periodSlug");

test("periodToUrlSlug returns YYYY-MM", () => {
  assert.equal(periodToUrlSlug(periods[0]!, periods), "2026-06");
});

test("isLegacyPeriodQuery detects internal ids", () => {
  assert.equal(isLegacyPeriodQuery("palak-euro__period_default"), true);
  assert.equal(isLegacyPeriodQuery("palak-euro_period_1782394897096"), true);
  assert.equal(isLegacyPeriodQuery("2026-06"), false);
});

test("resolvePeriodQueryToId from month slug", () => {
  assert.equal(resolvePeriodQueryToId(periods, "2026-06"), "sisaut__period_default");
  assert.equal(resolvePeriodQueryToId(periods, "2026-05"), "sisaut__period_archived");
});

test("resolvePeriodQueryToId from legacy id", () => {
  assert.equal(
    resolvePeriodQueryToId(periods, "sisaut__period_default"),
    "sisaut__period_default"
  );
});

test("periodIdToUrlSlug round-trip", () => {
  assert.equal(periodIdToUrlSlug("sisaut__period_default", periods), "2026-06");
});

test("periodQueryNeedsCanonicalReplace for legacy query", () => {
  assert.equal(
    periodQueryNeedsCanonicalReplace(
      "sisaut__period_default",
      periods,
      "sisaut__period_default"
    ),
    true
  );
  assert.equal(
    periodQueryNeedsCanonicalReplace("2026-06", periods, "sisaut__period_default"),
    false
  );
});

test("resolve foreign legacy id returns undefined", () => {
  assert.equal(
    resolvePeriodQueryToId(periods, "palak-euro_period_123"),
    undefined
  );
});

console.log("All periodSlug tests passed.");
