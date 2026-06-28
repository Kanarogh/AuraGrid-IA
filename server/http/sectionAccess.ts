import type { AssertClientAccessOptions } from "./auth";
import { assertClientAccess } from "./auth";
import type { AuthUser } from "../services/authService";

export const POSTS_READ: AssertClientAccessOptions = {
  section: "posts",
  minLevel: "read",
};

export const POSTS_WRITE: AssertClientAccessOptions = {
  section: "posts",
  minLevel: "write",
};

export const CATALOG_READ: AssertClientAccessOptions = {
  section: "catalog",
  minLevel: "read",
};

export const CATALOG_WRITE: AssertClientAccessOptions = {
  section: "catalog",
  minLevel: "write",
};

export const CANVA_READ: AssertClientAccessOptions = {
  section: "canva_grid",
  minLevel: "read",
};

export const CANVA_WRITE: AssertClientAccessOptions = {
  section: "canva_grid",
  minLevel: "write",
};

export const CONTENT_SCHEDULE_READ: AssertClientAccessOptions = {
  section: "content_schedule",
  minLevel: "read",
};

export const CONTENT_SCHEDULE_WRITE: AssertClientAccessOptions = {
  section: "content_schedule",
  minLevel: "write",
};

export const CONTENT_SCHEDULE_MANAGE: AssertClientAccessOptions = {
  section: "content_schedule",
  minLevel: "write",
  action: "managePlanningPeriods",
};

export const SETTINGS_READ: AssertClientAccessOptions = {
  section: "settings",
  minLevel: "read",
};

export const SETTINGS_WRITE: AssertClientAccessOptions = {
  section: "settings",
  minLevel: "write",
};

export const BRAND_GEM_WRITE: AssertClientAccessOptions = {
  section: "settings",
  minLevel: "write",
  action: "manageBrandGem",
};

export const REFERENCE_FINDER_READ: AssertClientAccessOptions = {
  section: "reference_finder",
  minLevel: "read",
};

export const FEED_SIMULATOR_READ: AssertClientAccessOptions = {
  section: "feed_simulator",
  minLevel: "read",
};

export const MANAGE_CLIENTS: AssertClientAccessOptions = {
  action: "manageClients",
};

export const MANAGE_AI_SETTINGS: AssertClientAccessOptions = {
  section: "settings",
  minLevel: "write",
  action: "manageAiSettings",
};

/** Validates PATCH workspace body against section write permissions. */
export async function assertWorkspacePatchAccess(
  user: AuthUser,
  clientId: string,
  body: Record<string, unknown>
): Promise<void> {
  const checks: AssertClientAccessOptions[] = [];
  if (body.posts !== undefined) checks.push(POSTS_WRITE);
  if (body.catalog !== undefined) checks.push(CATALOG_WRITE);
  if (body.canva !== undefined) checks.push(CANVA_WRITE);
  if (body.brandGem !== undefined) checks.push(BRAND_GEM_WRITE);
  if (
    body.planningPeriodId !== undefined ||
    body.startDate !== undefined ||
    body.ui !== undefined
  ) {
    checks.push(CONTENT_SCHEDULE_WRITE);
  }
  if (checks.length === 0) {
    await assertClientAccess(user, clientId, CONTENT_SCHEDULE_WRITE);
    return;
  }
  for (const check of checks) {
    await assertClientAccess(user, clientId, check);
  }
}
