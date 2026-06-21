import type { AppSection } from "../sectionMeta";
import type { PostsWorkTab } from "../../components/posts/PostsWorkspaceToolbar";

export type CatalogTab = "references" | "grid";

export type SettingsTab = "brand" | "captions" | "ai" | "appearance";

/** Rota dentro do workspace de um cliente. */
export type ClientRoute = {
  clientId: string;
  section: AppSection;
  postsTab?: PostsWorkTab;
  catalogTab?: CatalogTab;
  settingsTab?: SettingsTab;
  postId?: string;
  pageId?: string;
  slotId?: string;
  periodId?: string;
};

export type ParsedLocation =
  | { kind: "home" }
  | { kind: "login" }
  | { kind: "welcome" }
  | { kind: "client"; route: ClientRoute }
  | { kind: "unknown"; pathname: string };

export type NavigateOptions = {
  replace?: boolean;
  skipDirtyGuard?: boolean;
};

export type RouteValidationContext = {
  clientIds: string[];
  postIds: string[];
  pageIds: string[];
  slotIdsByPage: Map<string, string[]>;
  defaultPageId?: string;
  /** Quando false, não valida postId/pageId/slotId (workspace ainda carregando). */
  workspaceReady?: boolean;
};

export type RouteValidationResult =
  | { ok: true; route: ClientRoute }
  | { ok: false; route: ClientRoute; reason: string };
