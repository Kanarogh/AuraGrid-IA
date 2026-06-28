import assert from "node:assert/strict";
import {
  canAccessSection,
  canPerformAction,
  canUsePostScheduling,
  permissionsForRole,
} from "@/src/lib/permissions/roleTemplates";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok: ${name}`);
  } catch (err) {
    console.error(`  FAIL: ${name}`);
    throw err;
  }
}

test("editor role has no post_scheduling by default", () => {
  const perms = permissionsForRole("editor");
  assert.equal(canUsePostScheduling(perms), false);
});

test("manager role can publish", () => {
  const perms = permissionsForRole("manager");
  assert.equal(canUsePostScheduling(perms), true);
});

test("custom publish toggle", () => {
  const perms = permissionsForRole("editor");
  perms.sections.post_scheduling = "write";
  perms.actions.managePublish = true;
  assert.equal(canUsePostScheduling(perms), true);
});

test("viewer cannot write posts", () => {
  const perms = permissionsForRole("viewer");
  assert.equal(canAccessSection(perms, "posts", "write"), false);
  assert.equal(canAccessSection(perms, "posts", "read"), true);
});

test("editor cannot publish without toggle", () => {
  const perms = permissionsForRole("editor");
  assert.equal(canUsePostScheduling(perms), false);
  assert.equal(canPerformAction(perms, "managePublish"), false);
});

test("manager can manage planning periods", () => {
  const perms = permissionsForRole("manager");
  assert.equal(canPerformAction(perms, "managePlanningPeriods"), true);
});

console.log("permissionService template tests passed");
