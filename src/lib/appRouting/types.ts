import type { AppSection } from "../sectionMeta";
import type { PostsWorkTab } from "../../components/posts/PostsWorkspaceToolbar";
import type { PeriodRouteRef } from "./periodSlug";
import type { CanvaPageRouteRef } from "./canvaPageSlug";

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
  | { kind: "dashboard" }
  | { kind: "client"; route: ClientRoute }
  | { kind: "unknown"; pathname: string };

export type NavigateOptions = {
  replace?: boolean;
  skipDirtyGuard?: boolean;
};

/** Contexto para serializar slugs legíveis na URL. */
export type ClientRouteBuildContext = {
  periods?: PeriodRouteRef[];
  /** Omite ?period= quando periodId coincide com o roteiro padrão do workspace. */
  defaultPeriodId?: string;
  canvaPages?: CanvaPageRouteRef[];
  /** Omite pagina-N quando pageId coincide com a página padrão do workspace. */
  defaultCanvaPageId?: string;
};

export type RouteValidationContext = {
  clientIds: string[];
  postIds: string[];
  pageIds: string[];
  slotIdsByPage: Map<string, string[]>;
  canvaPages?: CanvaPageRouteRef[];
  periodIds?: string[];
  periods?: PeriodRouteRef[];
  /** Período ativo do workspace — fallback quando periodId na URL é inválido. */
  activePeriodId?: string;
  defaultPeriodId?: string;
  defaultPageId?: string;
  /** Quando false, não valida postId/pageId/slotId (workspace ainda carregando). */
  workspaceReady?: boolean;
};

export type RouteValidationResult =
  | { ok: true; route: ClientRoute }
  | { ok: false; route: ClientRoute; reason: string };
