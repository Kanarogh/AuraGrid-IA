import type { ClientActions, ClientPermissions, DisplayRole, PermissionSection, SectionLevel } from "./types";

const ALL_SECTIONS: PermissionSection[] = [
  "content_schedule",
  "posts",
  "post_scheduling",
  "canva_grid",
  "feed_simulator",
  "catalog",
  "reference_finder",
  "settings",
];

function sectionsMap(levels: Partial<Record<PermissionSection, SectionLevel>>): Partial<Record<PermissionSection, SectionLevel>> {
  const out: Partial<Record<PermissionSection, SectionLevel>> = {};
  for (const s of ALL_SECTIONS) {
    out[s] = levels[s] ?? "none";
  }
  return out;
}

export const OWNER_PERMISSIONS: ClientPermissions = {
  sections: sectionsMap(
    Object.fromEntries(ALL_SECTIONS.map((s) => [s, "write"])) as Record<PermissionSection, SectionLevel>
  ),
  actions: {
    manageTeam: true,
    manageClients: true,
    connectMeta: true,
    managePublish: true,
    managePlanningPeriods: true,
    manageBrandGem: true,
    manageAiSettings: true,
  },
};

export function permissionsForRole(role: DisplayRole, overrides?: Partial<ClientPermissions>): ClientPermissions {
  let base: ClientPermissions;
  switch (role) {
    case "manager":
      base = {
        sections: sectionsMap({
          content_schedule: "write",
          posts: "write",
          post_scheduling: "write",
          canva_grid: "write",
          feed_simulator: "write",
          catalog: "write",
          reference_finder: "write",
          settings: "read",
        }),
        actions: {
          managePublish: true,
          connectMeta: true,
          managePlanningPeriods: true,
          manageBrandGem: true,
        },
      };
      break;
    case "editor":
      base = {
        sections: sectionsMap({
          content_schedule: "write",
          posts: "write",
          canva_grid: "write",
          feed_simulator: "read",
          catalog: "write",
          reference_finder: "write",
          settings: "read",
        }),
        actions: {},
      };
      break;
    case "viewer":
      base = {
        sections: sectionsMap(
          Object.fromEntries(ALL_SECTIONS.map((s) => [s, "read"])) as Record<PermissionSection, SectionLevel>
        ),
        actions: {},
      };
      break;
    case "custom":
    default:
      base = {
        sections: sectionsMap({}),
        actions: {},
      };
  }
  if (!overrides) return base;
  return {
    sections: { ...base.sections, ...overrides.sections },
    actions: { ...base.actions, ...overrides.actions },
  };
}

export function sectionLevel(
  permissions: ClientPermissions,
  section: PermissionSection
): SectionLevel {
  return permissions.sections[section] ?? "none";
}

export function canAccessSection(
  permissions: ClientPermissions,
  section: PermissionSection,
  minLevel: "read" | "write"
): boolean {
  const level = sectionLevel(permissions, section);
  if (level === "none") return false;
  if (minLevel === "read") return level === "read" || level === "write";
  return level === "write";
}

export function canPerformAction(permissions: ClientPermissions, action: keyof ClientActions): boolean {
  return permissions.actions[action] === true;
}

export function canUsePostScheduling(permissions: ClientPermissions): boolean {
  return (
    canAccessSection(permissions, "post_scheduling", "write") &&
    canPerformAction(permissions, "managePublish")
  );
}
