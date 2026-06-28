export type {
  AccountRoute,
  AccountTab,
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
  ACCOUNT_TAB_SLUGS,
  CATALOG_TAB_SLUGS,
  POSTS_TAB_SLUGS,
  SECTION_SLUGS,
  SETTINGS_TAB_SLUGS,
  accountTabFromSlug,
  catalogTabFromSlug,
  defaultAccountTab,
  defaultCatalogTab,
  defaultPostsTab,
  defaultSettingsTab,
  postsTabFromSlug,
  sectionFromSlug,
  settingsTabFromSlug,
} from "./slugs";

export {
  buildAccountPath,
  buildClientPath,
  buildDashboardPath,
  buildHomeRedirectPath,
  buildLoginPath,
  mergeClientRoute,
  parseAppPath,
  pathsEqual,
  resolveLegacyAccountSettingsRedirect,
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
  canvaPageIdToUrlSlug,
  canvaPageSegmentNeedsCanonicalReplace,
  isCanvaPageUrlSlug,
  isLegacyCanvaPageSegment,
  resolveCanvaPageSegmentToId,
  type CanvaPageRouteRef,
} from "./canvaPageSlug";

export {
  AppNavigationProvider,
  useAppNavigation,
  resolvePendingNavigation,
  PENDING_NAV_TIMEOUT_MS,
  type PendingNavigation,
} from "./AppNavigationProvider";
