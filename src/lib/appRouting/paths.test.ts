import assert from "node:assert/strict";
import {
  buildClientPath,
  buildHomeRedirectPath,
  buildLoginPath,
  mergeClientRoute,
  parseAppPath,
  pathsEqual,
} from "./paths";
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

console.log("appRouting/paths");

test("parse home/login/welcome", () => {
  assert.deepEqual(parseAppPath("/"), { kind: "home" });
  assert.deepEqual(parseAppPath("/login"), { kind: "login" });
  assert.deepEqual(parseAppPath("/welcome"), { kind: "welcome" });
});

test("posts round-trip", () => {
  const route: ClientRoute = {
    clientId: "palak-br",
    section: "posts",
    postsTab: "day",
    postId: "post_day3",
    periodId: "2026-06",
  };
  const path = buildClientPath(route);
  assert.equal(path, "/c/palak-br/roteiros/dia/post_day3?period=2026-06");
  const parsed = parseAppPath("/c/palak-br/roteiros/dia/post_day3", "period=2026-06");
  assert.equal(parsed.kind, "client");
  if (parsed.kind !== "client") return;
  assert.equal(pathsEqual(parsed.route, route), true);
});

test("canva slot round-trip", () => {
  const route: ClientRoute = {
    clientId: "palak-br",
    section: "canva_grid",
    pageId: "page_1",
    slotId: "slot_abc",
  };
  const path = buildClientPath(route);
  assert.equal(path, "/c/palak-br/grid-canva/page_1/slot/slot_abc");
  const parsed = parseAppPath(path);
  assert.equal(parsed.kind, "client");
  if (parsed.kind !== "client") return;
  assert.equal(parsed.route.pageId, "page_1");
  assert.equal(parsed.route.slotId, "slot_abc");
});

test("settings tab default", () => {
  const path = buildClientPath({ clientId: "x", section: "settings" });
  assert.equal(path, "/c/x/configuracoes/marca");
});

test("mergeClientRoute clears entity on section change", () => {
  const base: ClientRoute = {
    clientId: "a",
    section: "posts",
    postsTab: "day",
    postId: "post_day1",
  };
  const merged = mergeClientRoute(base, { section: "canva_grid", pageId: "page_2" });
  assert.equal(merged.section, "canva_grid");
  assert.equal(merged.postId, undefined);
  assert.equal(merged.pageId, "page_2");
});

test("login returnTo", () => {
  assert.equal(
    buildLoginPath("/c/palak-br/roteiros"),
    "/login?returnTo=%2Fc%2Fpalak-br%2Froteiros"
  );
});

test("home redirect", () => {
  assert.equal(buildHomeRedirectPath("palak-br"), "/c/palak-br/roteiros/dia");
  assert.equal(buildHomeRedirectPath(undefined), "/welcome");
});

console.log("All appRouting tests passed.");
