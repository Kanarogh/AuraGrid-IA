import type { AppSection } from "../sectionMeta";
import { isAppSectionVisible } from "../sectionMeta";
import {
  defaultCatalogTab,
  defaultPostsTab,
  defaultSettingsTab,
} from "./slugs";
import { buildClientPath, buildHomeRedirectPath } from "./paths";
import {
  periodQueryNeedsCanonicalReplace,
  resolvePeriodQueryToId,
} from "./periodSlug";
import {
  canvaPageSegmentNeedsCanonicalReplace,
  resolveCanvaPageSegmentToId,
} from "./canvaPageSlug";
import type { ClientRoute, ClientRouteBuildContext, RouteValidationContext, RouteValidationResult } from "./types";

function withSectionDefaults(route: ClientRoute): ClientRoute {
  const next = { ...route };
  switch (next.section) {
    case "posts":
      next.postsTab ??= defaultPostsTab();
      break;
    case "catalog":
      next.catalogTab ??= defaultCatalogTab();
      break;
    case "settings":
      next.settingsTab ??= defaultSettingsTab();
      break;
    default:
      break;
  }
  return next;
}

function buildRouteBuildContext(ctx: RouteValidationContext): ClientRouteBuildContext {
  return {
    periods: ctx.periods,
    defaultPeriodId: ctx.defaultPeriodId ?? ctx.activePeriodId,
    canvaPages: ctx.canvaPages,
    defaultCanvaPageId: ctx.defaultPageId,
  };
}

/** Corrige clientId inválido ou entidades inexistentes. */
export function validateClientRoute(
  route: ClientRoute,
  ctx: RouteValidationContext
): RouteValidationResult {
  let next = withSectionDefaults(route);

  if (!isAppSectionVisible(next.section)) {
    next = { ...next, section: "posts", postsTab: defaultPostsTab() };
    return { ok: false, route: next, reason: "section_hidden" };
  }

  if (!ctx.clientIds.includes(next.clientId)) {
    const fallbackId = ctx.clientIds[0];
    if (!fallbackId) {
      return { ok: false, route: next, reason: "no_client" };
    }
    next = { ...next, clientId: fallbackId };
  }

  if (ctx.workspaceReady === false) {
    return { ok: true, route: withSectionDefaults(next) };
  }

  if (next.postId && !ctx.postIds.includes(next.postId)) {
    next = { ...next, postId: undefined };
  }

  if (next.section === "canva_grid" && next.pageId && ctx.canvaPages?.length) {
    const rawPageSegment = next.pageId;
    const resolved =
      resolveCanvaPageSegmentToId(ctx.canvaPages, rawPageSegment) ??
      (ctx.pageIds.includes(rawPageSegment) ? rawPageSegment : undefined);

    if (resolved && ctx.pageIds.includes(resolved)) {
      next = { ...next, pageId: resolved };
    } else if (ctx.defaultPageId && ctx.pageIds.includes(ctx.defaultPageId)) {
      next = { ...next, pageId: ctx.defaultPageId };
    } else {
      next = { ...next, pageId: undefined, slotId: undefined };
    }

    if (
      canvaPageSegmentNeedsCanonicalReplace(
        rawPageSegment,
        ctx.canvaPages,
        next.pageId
      )
    ) {
      return {
        ok: false,
        route: withSectionDefaults(next),
        reason: "canva_page_canonical",
      };
    }
  } else if (next.pageId && !ctx.pageIds.includes(next.pageId)) {
    next = { ...next, pageId: undefined, slotId: undefined };
  }

  if (next.pageId && next.slotId) {
    const slots = ctx.slotIdsByPage.get(next.pageId) ?? [];
    if (!slots.includes(next.slotId)) {
      next = { ...next, slotId: undefined };
    }
  }

  if (next.periodId && ctx.periods?.length) {
    const rawPeriodQuery = next.periodId;
    const resolved =
      resolvePeriodQueryToId(ctx.periods, rawPeriodQuery) ??
      (ctx.periodIds?.includes(rawPeriodQuery) ? rawPeriodQuery : undefined);

    if (resolved && ctx.periodIds?.includes(resolved)) {
      next = { ...next, periodId: resolved };
    } else if (ctx.activePeriodId && ctx.periodIds?.includes(ctx.activePeriodId)) {
      next = { ...next, periodId: ctx.activePeriodId };
    } else {
      next = { ...next, periodId: undefined };
    }

    if (
      periodQueryNeedsCanonicalReplace(
        rawPeriodQuery,
        ctx.periods,
        next.periodId
      )
    ) {
      return {
        ok: false,
        route: withSectionDefaults(next),
        reason: "period_canonical",
      };
    }
  } else if (next.periodId && ctx.periodIds?.length) {
    if (!ctx.periodIds.includes(next.periodId)) {
      next = {
        ...next,
        periodId: ctx.activePeriodId && ctx.periodIds.includes(ctx.activePeriodId)
          ? ctx.activePeriodId
          : undefined,
      };
    }
  }

  if (next.section === "canva_grid" && !next.pageId && ctx.defaultPageId) {
    next = { ...next, pageId: ctx.defaultPageId };
  }

  const buildCtx = buildRouteBuildContext(ctx);

  const canonical = withSectionDefaults(next);
  const ok =
    ctx.clientIds.includes(canonical.clientId) &&
    buildClientPath(canonical, buildCtx) ===
      buildClientPath(withSectionDefaults(route), buildCtx);

  return ok
    ? { ok: true, route: canonical }
    : { ok: false, route: canonical, reason: "corrected" };
}

export function resolveHomePath(
  clientIds: string[],
  activeClientId: string | undefined,
  lastSection?: AppSection
): string {
  const clientId =
    activeClientId && clientIds.includes(activeClientId)
      ? activeClientId
      : clientIds[0];
  return buildHomeRedirectPath(clientId, lastSection ?? "posts");
}
