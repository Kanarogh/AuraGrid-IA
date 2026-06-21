import type { AppSection } from "../sectionMeta";
import {
  defaultCatalogTab,
  defaultPostsTab,
  defaultSettingsTab,
} from "./slugs";
import { buildClientPath, buildHomeRedirectPath } from "./paths";
import type { ClientRoute, RouteValidationContext, RouteValidationResult } from "./types";

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

/** Corrige clientId inválido ou entidades inexistentes. */
export function validateClientRoute(
  route: ClientRoute,
  ctx: RouteValidationContext
): RouteValidationResult {
  let next = withSectionDefaults(route);

  if (!ctx.clientIds.includes(next.clientId)) {
    const fallbackId = ctx.clientIds[0];
    if (!fallbackId) {
      return { ok: false, route: next, reason: "no_client" };
    }
    next = { ...next, clientId: fallbackId };
  }

  if (next.postId && !ctx.postIds.includes(next.postId)) {
    next = { ...next, postId: undefined };
  }

  if (next.pageId && !ctx.pageIds.includes(next.pageId)) {
    next = { ...next, pageId: undefined, slotId: undefined };
  }

  if (next.pageId && next.slotId) {
    const slots = ctx.slotIdsByPage.get(next.pageId) ?? [];
    if (!slots.includes(next.slotId)) {
      next = { ...next, slotId: undefined };
    }
  }

  if (next.section === "canva_grid" && !next.pageId && ctx.defaultPageId) {
    next = { ...next, pageId: ctx.defaultPageId };
  }

  const canonical = withSectionDefaults(next);
  const ok =
    ctx.clientIds.includes(canonical.clientId) &&
    buildClientPath(canonical) === buildClientPath(withSectionDefaults(route));

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
