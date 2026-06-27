export type {
  CatalogTab,
  ClientRoute,
  ClientRouteBuildContext,
  NavigateOptions,
  ParsedLocation,
  RouteValidationContext,
  RouteValidationResult,
  SettingsTab,
} from "./types";

export {
  CATALOG_TAB_SLUGS,
  POSTS_TAB_SLUGS,
  SECTION_SLUGS,
  SETTINGS_TAB_SLUGS,
  catalogTabFromSlug,
  defaultCatalogTab,
  defaultPostsTab,
  defaultSettingsTab,
  postsTabFromSlug,
  sectionFromSlug,
  settingsTabFromSlug,
} from "./slugs";

export {
  buildClientPath,
  buildDashboardPath,
  buildHomeRedirectPath,
  buildLoginPath,
  mergeClientRoute,
  parseAppPath,
  pathsEqual,
} from "./paths";

export { resolveHomePath, validateClientRoute } from "./defaults";

export {
  clientRouteToStatePatch,
  postsTabToViewMode,
  stateToClientRoute,
  type AppNavigationState,
  type RouteStatePatch,
} from "./syncStateToRoute";

export {
  isLegacyPeriodQuery,
  periodIdToUrlSlug,
  periodQueryNeedsCanonicalReplace,
  periodToUrlSlug,
  resolvePeriodQueryToId,
  type PeriodRouteRef,
} from "./periodSlug";

export {
  AppNavigationProvider,
  useAppNavigation,
  resolvePendingNavigation,
  PENDING_NAV_TIMEOUT_MS,
  type PendingNavigation,
} from "./AppNavigationProvider";
