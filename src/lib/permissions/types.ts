/** Sections that can be permission-gated (mirrors AppSection + team settings tab). */
export type PermissionSection =
  | "content_schedule"
  | "posts"
  | "post_scheduling"
  | "canva_grid"
  | "feed_simulator"
  | "catalog"
  | "reference_finder"
  | "settings";

export type SectionLevel = "none" | "read" | "write";

export type ClientActions = {
  manageTeam?: boolean;
  manageClients?: boolean;
  connectMeta?: boolean;
  managePublish?: boolean;
  managePlanningPeriods?: boolean;
  manageBrandGem?: boolean;
  manageAiSettings?: boolean;
};

export type ClientPermissions = {
  sections: Partial<Record<PermissionSection, SectionLevel>>;
  actions: ClientActions;
};

export type DisplayRole = "manager" | "editor" | "viewer" | "custom";

export type AccountRole = "owner" | "member";
export type UserStatus = "active" | "suspended";

export type ClientAccessGrant = {
  clientId: string;
  permissions: ClientPermissions;
};

export type ResolvedClientAccess = {
  clientId: string;
  level: "owner" | "member";
  displayRole?: DisplayRole;
  permissions: ClientPermissions;
};

export type AuthUserProfile = {
  id: string;
  email: string;
  displayName: string;
  accountRole: AccountRole;
  mustChangePassword: boolean;
  status: UserStatus;
  teamOwnerId?: string;
  clientGrants: ClientAccessGrant[];
};
