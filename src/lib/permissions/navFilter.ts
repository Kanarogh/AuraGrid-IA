import type { AppSection } from "../sectionMeta";
import {
  canAccessSection,
  canPerformAction,
  canUsePostScheduling,
  OWNER_PERMISSIONS,
} from "./roleTemplates";
import type { AuthUserProfile, ClientPermissions, PermissionSection } from "./types";

const SECTION_MAP: Record<AppSection, PermissionSection | null> = {
  content_schedule: "content_schedule",
  posts: "posts",
  post_scheduling: "post_scheduling",
  canva_grid: "canva_grid",
  feed_simulator: "feed_simulator",
  catalog: "catalog",
  reference_finder: "reference_finder",
  settings: "settings",
};

export function permissionsForClient(
  profile: AuthUserProfile | null,
  clientId: string
): ClientPermissions | null {
  if (!profile) return null;
  if (profile.accountRole === "owner") return OWNER_PERMISSIONS;
  const grant = profile.clientGrants.find((g) => g.clientId === clientId);
  return grant?.permissions ?? null;
}

export function canAccessAppSection(
  profile: AuthUserProfile | null,
  clientId: string,
  section: AppSection,
  minLevel: "read" | "write" = "read"
): boolean {
  if (!profile) return false;
  if (section === "post_scheduling") {
    const perms = permissionsForClient(profile, clientId);
    if (!perms) return false;
    return canUsePostScheduling(perms);
  }
  const permSection = SECTION_MAP[section];
  if (!permSection) return false;
  const perms = permissionsForClient(profile, clientId);
  if (!perms) return false;
  return canAccessSection(perms, permSection, minLevel);
}

export function canManageTeam(profile: AuthUserProfile | null): boolean {
  return profile?.accountRole === "owner";
}

export function canManageClients(profile: AuthUserProfile | null, clientId?: string): boolean {
  if (!profile) return false;
  if (profile.accountRole === "owner") return true;
  if (!clientId) return false;
  const perms = permissionsForClient(profile, clientId);
  return perms ? canPerformAction(perms, "manageClients") : false;
}

export function filterNavSections(
  profile: AuthUserProfile | null,
  clientId: string,
  sections: AppSection[]
): AppSection[] {
  return sections.filter((s) => canAccessAppSection(profile, clientId, s, "read"));
}
