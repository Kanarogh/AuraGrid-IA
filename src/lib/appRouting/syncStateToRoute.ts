import type { AppSection } from "../sectionMeta";
import type { PostsWorkTab } from "../../components/posts/PostsWorkspaceToolbar";
import type { CatalogTab, ClientRoute, SettingsTab } from "./types";

export type AppNavigationState = {
  clientId: string;
  section: AppSection;
  postsWorkTab: PostsWorkTab;
  catalogTab: CatalogTab;
  settingsTab: SettingsTab;
  activePreviewId: string;
  activeCanvaPageId: string;
  selectedCanvaSlotId: string | null;
  activePlanningPeriodId: string;
};

/** Deriva rota canônica a partir do estado atual do App. Retorna null se clientId vazio. */
export function stateToClientRoute(state: AppNavigationState): ClientRoute | null {
  if (!state.clientId?.trim()) return null;

  const route: ClientRoute = {
    clientId: state.clientId,
    section: state.section,
    periodId: state.activePlanningPeriodId || undefined,
  };

  switch (state.section) {
    case "posts":
      route.postsTab = state.postsWorkTab;
      if (state.postsWorkTab === "day" && state.activePreviewId) {
        route.postId = state.activePreviewId;
      }
      break;
    case "catalog":
      route.catalogTab = state.catalogTab;
      break;
    case "settings":
      route.settingsTab = state.settingsTab;
      break;
    case "canva_grid":
      if (state.activeCanvaPageId) route.pageId = state.activeCanvaPageId;
      if (state.selectedCanvaSlotId) route.slotId = state.selectedCanvaSlotId;
      break;
    default:
      break;
  }

  return route;
}

export type RouteStatePatch = {
  section?: AppSection;
  postsWorkTab?: PostsWorkTab;
  catalogTab?: CatalogTab;
  settingsTab?: SettingsTab;
  activePreviewId?: string;
  activeCanvaPageId?: string;
  selectedCanvaSlotId?: string | null;
  activePlanningPeriodId?: string;
};

/** Extrai patch de estado a partir de uma rota parseada. */
export function clientRouteToStatePatch(route: ClientRoute): RouteStatePatch {
  const patch: RouteStatePatch = {
    section: route.section,
  };

  if (route.periodId) patch.activePlanningPeriodId = route.periodId;

  switch (route.section) {
    case "posts":
      if (route.postsTab) patch.postsWorkTab = route.postsTab;
      if (route.postId) patch.activePreviewId = route.postId;
      break;
    case "catalog":
      if (route.catalogTab) patch.catalogTab = route.catalogTab;
      break;
    case "settings":
      if (route.settingsTab) patch.settingsTab = route.settingsTab;
      break;
    case "canva_grid":
      if (route.pageId) patch.activeCanvaPageId = route.pageId;
      if (route.slotId) patch.selectedCanvaSlotId = route.slotId;
      else if (route.pageId) patch.selectedCanvaSlotId = null;
      break;
    default:
      break;
  }

  return patch;
}

export function postsTabToViewMode(tab: PostsWorkTab): "split" | "editorial" {
  return tab === "calendar" ? "editorial" : "split";
}
