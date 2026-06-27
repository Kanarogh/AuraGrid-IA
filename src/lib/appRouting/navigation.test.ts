import assert from "node:assert/strict";
import { buildClientPath } from "./paths";
import { validateClientRoute } from "./defaults";
import {
  PENDING_NAV_TIMEOUT_MS,
  resolvePendingNavigation,
  type PendingNavigation,
} from "./AppNavigationProvider";
import type { ClientRoute } from "./types";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok: ${name}`);
  } catch (err) {
    console.error(`  FAIL: ${name}`);
    throw err;
  }
}

console.log("appRouting/navigation");

test("buildClientPath never produces /c// when clientId empty", () => {
  const path = buildClientPath({ clientId: "", section: "posts" });
  assert.equal(path.includes("/c//"), false);
  assert.equal(path, "/welcome");
});

test("resolvePendingNavigation match clears on same path", () => {
  const pending: PendingNavigation = {
    id: 1,
    targetPath: "/c/a/roteiros",
    startedAt: Date.now(),
  };
  assert.equal(resolvePendingNavigation(pending, "/c/a/roteiros"), "match");
});

test("resolvePendingNavigation blocked on different path", () => {
  const pending: PendingNavigation = {
    id: 1,
    targetPath: "/c/a/grid-canva",
    startedAt: Date.now(),
  };
  assert.equal(resolvePendingNavigation(pending, "/c/a/roteiros"), "blocked");
});

test("resolvePendingNavigation expires after timeout", () => {
  const pending: PendingNavigation = {
    id: 1,
    targetPath: "/c/a/roteiros",
    startedAt: Date.now() - PENDING_NAV_TIMEOUT_MS - 1,
  };
  assert.equal(resolvePendingNavigation(pending, "/c/a/roteiros"), "expired");
});

test("validateClientRoute preserves postId when workspace not ready", () => {
  const route: ClientRoute = {
    clientId: "palak-br",
    section: "posts",
    postsTab: "day",
    postId: "post_day99",
  };
  const result = validateClientRoute(route, {
    clientIds: ["palak-br"],
    postIds: ["post_day1"],
    pageIds: [],
    slotIdsByPage: new Map(),
    workspaceReady: false,
  });
  assert.equal(result.ok, true);
  assert.equal(result.route.postId, "post_day99");
});

test("validateClientRoute strips invalid postId when workspace ready", () => {
  const route: ClientRoute = {
    clientId: "palak-br",
    section: "posts",
    postsTab: "day",
    postId: "post_day99",
  };
  const result = validateClientRoute(route, {
    clientIds: ["palak-br"],
    postIds: ["post_day1"],
    pageIds: [],
    slotIdsByPage: new Map(),
    workspaceReady: true,
  });
  assert.equal(result.ok, false);
  assert.equal(result.route.postId, undefined);
});

test("validateClientRoute replaces foreign periodId with active period", () => {
  const route: ClientRoute = {
    clientId: "sisaut",
    section: "catalog",
    catalogTab: "references",
    periodId: "palak-euro_period_123",
  };
  const periods = [
    {
      id: "sisaut_period_456",
      startDate: "2026-06-01",
      status: "active" as const,
    },
  ];
  const result = validateClientRoute(route, {
    clientIds: ["sisaut", "palak-euro"],
    postIds: [],
    pageIds: [],
    slotIdsByPage: new Map(),
    periodIds: ["sisaut_period_456"],
    periods,
    activePeriodId: "sisaut_period_456",
    defaultPeriodId: "sisaut_period_456",
    workspaceReady: true,
  });
  assert.equal(result.ok, false);
  assert.equal(result.route.periodId, "sisaut_period_456");
  assert.equal(
    buildClientPath(result.route, { periods, defaultPeriodId: "sisaut_period_456" }),
    "/c/sisaut/catalogo/referencias"
  );
});

test("validateClientRoute canonicalizes legacy period query to YYYY-MM slug", () => {
  const route: ClientRoute = {
    clientId: "sisaut",
    section: "catalog",
    catalogTab: "references",
    periodId: "sisaut_period_456",
  };
  const periods = [
    {
      id: "sisaut_period_456",
      startDate: "2026-06-01",
      status: "active" as const,
    },
  ];
  const result = validateClientRoute(route, {
    clientIds: ["sisaut"],
    postIds: [],
    pageIds: [],
    slotIdsByPage: new Map(),
    periodIds: ["sisaut_period_456"],
    periods,
    activePeriodId: "sisaut_period_456",
    workspaceReady: true,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "period_canonical");
  assert.equal(
    buildClientPath(result.route, { periods, defaultPeriodId: "sisaut_period_456" }),
    "/c/sisaut/catalogo/referencias"
  );
});

test("buildClientPath emits readable period slug when not default", () => {
  const periods = [
    {
      id: "sisaut_period_456",
      startDate: "2026-06-01",
      status: "active" as const,
    },
    {
      id: "sisaut_period_789",
      startDate: "2026-05-01",
      status: "archived" as const,
    },
  ];
  const route: ClientRoute = {
    clientId: "sisaut",
    section: "catalog",
    catalogTab: "references",
    periodId: "sisaut_period_789",
  };
  assert.equal(
    buildClientPath(route, { periods, defaultPeriodId: "sisaut_period_456" }),
    "/c/sisaut/catalogo/referencias?period=2026-05"
  );
});

console.log("\nAll navigation tests passed.");
