import type { AppSection } from "../sectionMeta";
import {
  ACCOUNT_TAB_SLUGS,
  CATALOG_TAB_SLUGS,
  LEGACY_ACCOUNT_SETTINGS_SLUGS,
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
import type { AccountRoute, ClientRoute, ParsedLocation, ClientRouteBuildContext } from "./types";
import {
  isLegacyPeriodQuery,
  periodIdToUrlSlug,
} from "./periodSlug";
import {
  canvaPageIdToUrlSlug,
  isCanvaPageUrlSlug,
  isLegacyCanvaPageSegment,
} from "./canvaPageSlug";

function encodeSegment(value: string): string {
  return encodeURIComponent(value);
}

function periodQueryForPath(
  route: ClientRoute,
  ctx?: ClientRouteBuildContext
): string | undefined {
  if (!route.periodId) return undefined;

  if (ctx?.periods?.length) {
    if (ctx.defaultPeriodId && route.periodId === ctx.defaultPeriodId) {
      return undefined;
    }
    return periodIdToUrlSlug(route.periodId, ctx.periods);
  }

  const raw = route.periodId;
  if (/^\d{4}-\d{2}(-\d{2})?$/.test(raw)) return raw;
  if (isLegacyPeriodQuery(raw)) return undefined;
  return raw;
}

function canvaPageSegmentForPath(
  pageId: string | undefined,
  ctx?: ClientRouteBuildContext,
  options?: { forceInclude?: boolean }
): string | undefined {
  if (!pageId) return undefined;

  if (ctx?.canvaPages?.length) {
    if (isCanvaPageUrlSlug(pageId)) return pageId;
    if (
      !options?.forceInclude &&
      ctx.defaultCanvaPageId &&
      pageId === ctx.defaultCanvaPageId
    ) {
      return undefined;
    }
    return canvaPageIdToUrlSlug(pageId, ctx.canvaPages);
  }

  const raw = pageId;
  if (isCanvaPageUrlSlug(raw)) return raw;
  if (isLegacyCanvaPageSegment(raw)) return undefined;
  return raw;
}

/** Monta pathname + query a partir de uma rota de cliente. */
export function buildClientPath(route: ClientRoute, ctx?: ClientRouteBuildContext): string {
  if (!route.clientId?.trim()) return "/welcome";

  const base = `/c/${encodeSegment(route.clientId)}/${SECTION_SLUGS[route.section]}`;
  const parts: string[] = [];

  switch (route.section) {
    case "posts": {
      const tab = route.postsTab ?? defaultPostsTab();
      parts.push(POSTS_TAB_SLUGS[tab]);
      if (route.postId && tab === "day") {
        parts.push(encodeSegment(route.postId));
      }
      break;
    }
    case "catalog": {
      const tab = route.catalogTab ?? defaultCatalogTab();
      parts.push(CATALOG_TAB_SLUGS[tab]);
      break;
    }
    case "settings": {
      const tab = route.settingsTab ?? defaultSettingsTab();
      parts.push(SETTINGS_TAB_SLUGS[tab]);
      break;
    }
    case "canva_grid": {
      const pageSegment = canvaPageSegmentForPath(route.pageId, ctx, {
        forceInclude: Boolean(route.slotId),
      });
      if (pageSegment) {
        parts.push(encodeSegment(pageSegment));
        if (route.slotId) {
          parts.push("slot", encodeSegment(route.slotId));
        }
      }
      break;
    }
    default:
      break;
  }

  const pathname = parts.length > 0 ? `${base}/${parts.join("/")}` : base;
  const periodQuery = periodQueryForPath(route, ctx);
  if (periodQuery) {
    const qs = new URLSearchParams({ period: periodQuery });
    return `${pathname}?${qs.toString()}`;
  }
  return pathname;
}

export function buildDashboardPath(): string {
  return "/dashboard";
}

export function buildAccountPath(route: AccountRoute): string {
  return `/conta/${ACCOUNT_TAB_SLUGS[route.tab]}`;
}

/** Redireciona tabs de conta que ainda usam URL antiga em /c/:id/configuracoes/… */
export function resolveLegacyAccountSettingsRedirect(pathname: string): string | null {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  const match = normalized.match(/^\/c\/[^/]+\/configuracoes(?:\/([^/]+))?$/);
  if (!match) return null;
  const tabSlug = match[1];
  if (!tabSlug) return null;
  if (!LEGACY_ACCOUNT_SETTINGS_SLUGS.has(tabSlug)) return null;
  const tab = accountTabFromSlug(tabSlug);
  if (!tab) return null;
  return buildAccountPath({ tab });
}

export function buildLoginPath(returnTo?: string): string {
  if (!returnTo || returnTo === "/login") return "/login";
  return `/login?returnTo=${encodeURIComponent(returnTo)}`;
}

export function buildHomeRedirectPath(
  clientId: string | undefined,
  fallbackSection: AppSection = "posts"
): string {
  if (!clientId) return "/welcome";
  return buildClientPath({
    clientId,
    section: fallbackSection,
    postsTab: fallbackSection === "posts" ? defaultPostsTab() : undefined,
    catalogTab: fallbackSection === "catalog" ? defaultCatalogTab() : undefined,
    settingsTab: fallbackSection === "settings" ? defaultSettingsTab() : undefined,
  });
}

function parseClientSegments(
  clientId: string,
  segments: string[],
  periodId?: string
): ClientRoute | null {
  if (segments.length === 0) {
    return {
      clientId,
      section: "posts",
      postsTab: defaultPostsTab(),
      periodId,
    };
  }

  const sectionSlug = segments[0];
  const section = sectionFromSlug(sectionSlug);
  if (!section) return null;

  const rest = segments.slice(1);
  const route: ClientRoute = { clientId, section, periodId };

  switch (section) {
    case "posts": {
      if (rest.length === 0) {
        route.postsTab = defaultPostsTab();
        return route;
      }
      const tab = postsTabFromSlug(rest[0]);
      if (!tab) return null;
      route.postsTab = tab;
      if (tab === "day" && rest.length >= 2) {
        route.postId = decodeURIComponent(rest[1]);
      }
      if (rest.length > (tab === "day" && route.postId ? 2 : 1)) return null;
      return route;
    }
    case "catalog": {
      if (rest.length === 0) {
        route.catalogTab = defaultCatalogTab();
        return route;
      }
      const tab = catalogTabFromSlug(rest[0]);
      if (!tab || rest.length > 1) return null;
      route.catalogTab = tab;
      return route;
    }
    case "settings": {
      if (rest.length === 0) {
        route.settingsTab = defaultSettingsTab();
        return route;
      }
      const tab = settingsTabFromSlug(rest[0]);
      if (!tab || rest.length > 1) return null;
      route.settingsTab = tab;
      return route;
    }
    case "canva_grid": {
      if (rest.length === 0) return route;
      route.pageId = decodeURIComponent(rest[0]);
      if (rest.length === 1) return route;
      if (rest[1] === "slot" && rest.length === 3) {
        route.slotId = decodeURIComponent(rest[2]);
        return route;
      }
      return null;
    }
    case "feed_simulator":
    case "reference_finder":
    case "content_schedule":
    case "post_scheduling":
      return rest.length === 0 ? route : null;
    default:
      return null;
  }
}

/** Interpreta pathname + searchParams do browser. */
export function parseAppPath(
  pathname: string,
  searchParams?: URLSearchParams | string | null
): ParsedLocation {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  const params =
    typeof searchParams === "string"
      ? new URLSearchParams(searchParams)
      : searchParams ?? new URLSearchParams();
  const periodId = params.get("period") ?? undefined;

  if (normalized === "/") return { kind: "home" };
  if (normalized === "/login") return { kind: "login" };
  if (normalized === "/welcome") return { kind: "welcome" };
  if (normalized === "/dashboard") return { kind: "dashboard" };

  if (normalized === "/conta" || normalized.startsWith("/conta/")) {
    const segments = normalized.slice("/conta".length).split("/").filter(Boolean);
    if (segments.length === 0) {
      return { kind: "account", route: { tab: defaultAccountTab() } };
    }
    if (segments.length === 1) {
      const tab = accountTabFromSlug(segments[0]);
      if (tab) return { kind: "account", route: { tab } };
    }
    return { kind: "unknown", pathname: normalized };
  }

  const clientMatch = normalized.match(/^\/c\/([^/]+)(?:\/(.*))?$/);
  if (!clientMatch) return { kind: "unknown", pathname: normalized };

  const clientId = decodeURIComponent(clientMatch[1]);
  const tail = clientMatch[2];
  const segments = tail ? tail.split("/").filter(Boolean) : [];
  const route = parseClientSegments(clientId, segments, periodId);
  if (!route) return { kind: "unknown", pathname: normalized };

  return { kind: "client", route };
}

export function pathsEqual(
  a: ClientRoute,
  b: ClientRoute,
  ctx?: ClientRouteBuildContext
): boolean {
  return buildClientPath(a, ctx) === buildClientPath(b, ctx);
}

export function mergeClientRoute(base: ClientRoute, partial: Partial<ClientRoute>): ClientRoute {
  const next: ClientRoute = { ...base };
  if (partial.clientId && partial.clientId !== base.clientId) {
    delete next.periodId;
    delete next.postId;
    delete next.pageId;
    delete next.slotId;
  }
  if (partial.section && partial.section !== base.section) {
    delete next.postId;
    delete next.pageId;
    delete next.slotId;
    if (partial.section !== "posts") delete next.postsTab;
    if (partial.section !== "catalog") delete next.catalogTab;
    if (partial.section !== "settings") delete next.settingsTab;
  }
  if (partial.postsTab && partial.postsTab !== "day") {
    delete next.postId;
  }
  if (partial.postId === undefined && "postId" in partial) {
    delete next.postId;
  }
  return { ...next, ...partial };
}
