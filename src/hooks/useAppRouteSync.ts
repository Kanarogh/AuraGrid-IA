"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { confirmDialog } from "../lib/confirmDialog";
import {
  buildClientPath,
  clientRouteToStatePatch,
  mergeClientRoute,
  pathsEqual,
  postsTabToViewMode,
  stateToClientRoute,
  useAppNavigation,
  validateClientRoute,
  resolvePendingNavigation,
  type CatalogTab,
  type ClientRoute,
  type NavigateOptions,
  type RouteStatePatch,
  type SettingsTab,
} from "../lib/appRouting";
import type { AppSection } from "../lib/sectionMeta";
import type { PostsWorkTab } from "../components/posts/PostsWorkspaceToolbar";
import type { CanvaGridPage, PlannedPost } from "../types";
import type { PlanningPeriod } from "../lib/planningConstants";
import type { ClientRouteBuildContext } from "../lib/appRouting";

export type AppRouteSyncHandlers = {
  setActiveSection: (section: AppSection) => void;
  setPostsWorkTab: (tab: PostsWorkTab) => void;
  setViewMode: (mode: "split" | "editorial") => void;
  setCatalogTab: (tab: CatalogTab) => void;
  setSettingsTab: (tab: SettingsTab) => void;
  setActivePreviewId: (id: string) => void;
  setActiveCanvaPageId: (id: string) => void;
  setSelectedCanvaSlotId: (id: string | null) => void;
  switchPlanningPeriod: (periodId: string) => void | Promise<void>;
  switchClient: (clientId: string) => void;
};

type UseAppRouteSyncArgs = {
  enabled: boolean;
  hasActiveClient: boolean;
  effectiveActiveClientId: string;
  registryClientIds: string[];
  activeSection: AppSection;
  settingsDraftDirty: boolean;
  postsWorkTab: PostsWorkTab;
  catalogTab: CatalogTab;
  settingsTab: SettingsTab;
  activePreviewId: string;
  activeCanvaPageId: string;
  selectedCanvaSlotId: string | null;
  activePlanningPeriodId: string;
  planningPeriodIds: string[];
  planningPeriods: PlanningPeriod[];
  posts: PlannedPost[];
  canvaPages: CanvaGridPage[];
  handlers: AppRouteSyncHandlers;
};

function buildValidationContext(
  registryClientIds: string[],
  posts: PlannedPost[],
  canvaPages: CanvaGridPage[],
  planningPeriodIds: string[],
  planningPeriods: PlanningPeriod[],
  activePeriodId: string,
  defaultPageId?: string,
  workspaceReady = true
) {
  const slotIdsByPage = new Map<string, string[]>();
  for (const page of canvaPages) {
    slotIdsByPage.set(
      page.id,
      page.slots.map((s) => s.id)
    );
  }
  return {
    clientIds: registryClientIds,
    postIds: posts.map((p) => p.id),
    pageIds: canvaPages.map((p) => p.id),
    canvaPages: canvaPages.map((p) => ({ id: p.id })),
    slotIdsByPage,
    periodIds: planningPeriodIds,
    periods: planningPeriods,
    activePeriodId,
    defaultPeriodId: activePeriodId,
    defaultPageId,
    workspaceReady,
  };
}

function buildRouteBuildContext(
  planningPeriods: PlanningPeriod[],
  activePeriodId: string,
  canvaPages: CanvaGridPage[],
  activeCanvaPageId: string
): ClientRouteBuildContext {
  return {
    periods: planningPeriods,
    defaultPeriodId: activePeriodId,
    canvaPages: canvaPages.map((p) => ({ id: p.id })),
    defaultCanvaPageId: activeCanvaPageId,
  };
}

function buildNextRoute(
  partial: Partial<ClientRoute>,
  clientRoute: ClientRoute | null,
  stateRoute: ClientRoute | null,
  effectiveActiveClientId: string
): ClientRoute | null {
  if (!effectiveActiveClientId) return null;

  const base =
    clientRoute ??
    stateRoute ??
    ({ clientId: effectiveActiveClientId, section: "posts" } as ClientRoute);

  return mergeClientRoute(
    { ...base, clientId: partial.clientId ?? base.clientId ?? effectiveActiveClientId },
    { ...partial, clientId: partial.clientId ?? base.clientId ?? effectiveActiveClientId }
  );
}

function enrichRouteBeforePush(
  route: ClientRoute,
  activeCanvaPageId: string,
  ctx: ReturnType<typeof buildValidationContext>
): ClientRoute {
  let next = route;
  if (next.section === "canva_grid" && !next.pageId && activeCanvaPageId) {
    next = { ...next, pageId: activeCanvaPageId };
  }
  return validateClientRoute(next, ctx).route;
}

export function useAppRouteSync({
  enabled,
  hasActiveClient,
  effectiveActiveClientId,
  registryClientIds,
  activeSection,
  settingsDraftDirty,
  postsWorkTab,
  catalogTab,
  settingsTab,
  activePreviewId,
  activeCanvaPageId,
  selectedCanvaSlotId,
  activePlanningPeriodId,
  planningPeriodIds,
  planningPeriods,
  posts,
  canvaPages,
  handlers,
}: UseAppRouteSyncArgs) {
  const {
    clientRoute,
    navigateClient: pushClientRoute,
    replaceClientRoute,
    setBeforeNavigate,
    pendingNavigationRef,
    registerCommitNavigation,
    registerRouteBuildContext,
    isApplyingRouteRef,
  } = useAppNavigation();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const applyingFromUrlRef = useRef(false);
  const activeSectionRef = useRef(activeSection);
  const settingsDraftDirtyRef = useRef(settingsDraftDirty);
  activeSectionRef.current = activeSection;
  settingsDraftDirtyRef.current = settingsDraftDirty;

  const routeBuildCtx = buildRouteBuildContext(
    planningPeriods,
    activePlanningPeriodId,
    canvaPages,
    activeCanvaPageId
  );

  const currentRouteFromState = useCallback(
    () =>
      stateToClientRoute({
        clientId: effectiveActiveClientId,
        section: activeSection,
        postsWorkTab,
        catalogTab,
        settingsTab,
        activePreviewId,
        activeCanvaPageId,
        selectedCanvaSlotId,
        activePlanningPeriodId,
      }),
    [
      effectiveActiveClientId,
      activeSection,
      postsWorkTab,
      catalogTab,
      settingsTab,
      activePreviewId,
      activeCanvaPageId,
      selectedCanvaSlotId,
      activePlanningPeriodId,
    ]
  );

  const applyPatch = useCallback(
    (patch: RouteStatePatch) => {
      applyingFromUrlRef.current = true;
      if (patch.section) handlers.setActiveSection(patch.section);
      if (patch.postsWorkTab) {
        handlers.setPostsWorkTab(patch.postsWorkTab);
        handlers.setViewMode(postsTabToViewMode(patch.postsWorkTab));
      }
      if (patch.catalogTab) handlers.setCatalogTab(patch.catalogTab);
      if (patch.settingsTab) handlers.setSettingsTab(patch.settingsTab);
      if (patch.activePreviewId) handlers.setActivePreviewId(patch.activePreviewId);
      if (patch.activeCanvaPageId) handlers.setActiveCanvaPageId(patch.activeCanvaPageId);
      if (patch.selectedCanvaSlotId !== undefined) {
        handlers.setSelectedCanvaSlotId(patch.selectedCanvaSlotId);
      }
      if (patch.activePlanningPeriodId) {
        void handlers.switchPlanningPeriod(patch.activePlanningPeriodId);
      }
      queueMicrotask(() => {
        applyingFromUrlRef.current = false;
      });
    },
    [handlers]
  );

  const commitNavigation = useCallback(
    async (partial: Partial<ClientRoute>, options?: NavigateOptions): Promise<boolean> => {
      if (!effectiveActiveClientId) return false;

      const stateRoute = currentRouteFromState();
      const built = buildNextRoute(
        partial,
        clientRoute,
        stateRoute,
        effectiveActiveClientId
      );
      if (!built) return false;

      const ctx = buildValidationContext(
        registryClientIds,
        posts,
        canvaPages,
        planningPeriodIds,
        planningPeriods,
        activePlanningPeriodId,
        activeCanvaPageId,
        clientRoute?.clientId === effectiveActiveClientId
      );
      const nextRoute = enrichRouteBeforePush(built, activeCanvaPageId, ctx);
      const nextPath = buildClientPath(nextRoute, routeBuildCtx);
      const currentPath = searchParams.toString()
        ? `${pathname}?${searchParams.toString()}`
        : pathname;

      if (nextPath === currentPath) {
        applyPatch(clientRouteToStatePatch(nextRoute));
        return true;
      }

      const ok = await pushClientRoute(nextRoute, options);
      return ok;
    },
    [
      effectiveActiveClientId,
      currentRouteFromState,
      clientRoute,
      pushClientRoute,
      applyPatch,
      registryClientIds,
      posts,
      canvaPages,
      planningPeriodIds,
      planningPeriods,
      activePlanningPeriodId,
      activeCanvaPageId,
      routeBuildCtx,
      pathname,
      searchParams,
    ]
  );

  useEffect(() => {
    setBeforeNavigate(async (next: ClientRoute) => {
      if (
        activeSectionRef.current === "settings" &&
        settingsDraftDirtyRef.current &&
        next.section !== "settings"
      ) {
        return confirmDialog({
          title: "Alterações não salvas",
          message:
            "Você tem alterações no Gem da marca que ainda não foram salvas. Sair sem salvar?",
          variant: "danger",
          confirmLabel: "Sair sem salvar",
        });
      }
      return true;
    });
    return () => setBeforeNavigate(null);
  }, [setBeforeNavigate]);

  useEffect(() => {
    registerCommitNavigation(commitNavigation);
    return () => registerCommitNavigation(null);
  }, [commitNavigation, registerCommitNavigation]);

  useEffect(() => {
    registerRouteBuildContext(() => routeBuildCtx);
    return () => registerRouteBuildContext(null);
  }, [registerRouteBuildContext, routeBuildCtx]);

  /** Troca de cliente só quando a URL muda — não a cada update de posts/canva. */
  useEffect(() => {
    if (!enabled || !clientRoute || !hasActiveClient) return;
    const routeClientId = clientRoute.clientId;
    if (!routeClientId || routeClientId === effectiveActiveClientId) return;
    handlers.switchClient(routeClientId);
  }, [
    enabled,
    hasActiveClient,
    clientRoute?.clientId,
    effectiveActiveClientId,
    handlers.switchClient,
  ]);

  /** Canonicaliza ?period= legado ou inválido (replace silencioso). */
  useEffect(() => {
    if (!enabled || !clientRoute || !hasActiveClient) return;
    if (applyingFromUrlRef.current) return;
    if (clientRoute.clientId !== effectiveActiveClientId) return;
    if (!planningPeriods.length) return;

    const ctx = buildValidationContext(
      registryClientIds,
      posts,
      canvaPages,
      planningPeriodIds,
      planningPeriods,
      activePlanningPeriodId,
      activeCanvaPageId,
      true
    );
    const validated = validateClientRoute(clientRoute, ctx);
    if (validated.ok) return;

    const canonicalPath = buildClientPath(validated.route, routeBuildCtx);
    const currentPath = searchParams.toString()
      ? `${pathname}?${searchParams.toString()}`
      : pathname;
    if (canonicalPath === currentPath) return;

    replaceClientRoute(validated.route);
  }, [
    enabled,
    hasActiveClient,
    clientRoute,
    pathname,
    searchParams,
    effectiveActiveClientId,
    registryClientIds,
    posts,
    canvaPages,
    planningPeriodIds,
    planningPeriods,
    activePlanningPeriodId,
    activeCanvaPageId,
    replaceClientRoute,
    routeBuildCtx,
  ]);

  /** URL → patch de seção/abas/period (sem reconciliar state→URL). */
  useEffect(() => {
    if (!enabled || !clientRoute || !hasActiveClient) return;
    if (applyingFromUrlRef.current) return;
    if (isApplyingRouteRef.current) return;

    const routePath = buildClientPath(clientRoute, routeBuildCtx);
    const pendingStatus = resolvePendingNavigation(pendingNavigationRef.current, routePath);

    if (pendingStatus === "blocked") return;

    const workspaceReady = clientRoute.clientId === effectiveActiveClientId;
    const ctx = buildValidationContext(
      registryClientIds,
      posts,
      canvaPages,
      planningPeriodIds,
      planningPeriods,
      activePlanningPeriodId,
      activeCanvaPageId,
      workspaceReady
    );
    const validated = validateClientRoute(clientRoute, ctx);

    if (pendingStatus === "match") {
      pendingNavigationRef.current = null;
      applyPatch(clientRouteToStatePatch(validated.route));
      return;
    }

    applyPatch(clientRouteToStatePatch(validated.route));
  }, [
    enabled,
    pathname,
    searchParams,
    clientRoute,
    hasActiveClient,
    effectiveActiveClientId,
    registryClientIds,
    planningPeriodIds,
    planningPeriods,
    activePlanningPeriodId,
    applyPatch,
    pendingNavigationRef,
    isApplyingRouteRef,
    routeBuildCtx,
    posts,
    canvaPages,
    activeCanvaPageId,
  ]);

  /** State → URL quando diverge (ex.: navegação interna sem push). */
  useEffect(() => {
    if (!enabled || !clientRoute || !hasActiveClient) return;
    if (applyingFromUrlRef.current) return;
    if (isApplyingRouteRef.current) return;
    if (clientRoute.clientId !== effectiveActiveClientId) return;

    const routePath = buildClientPath(clientRoute, routeBuildCtx);
    const pendingStatus = resolvePendingNavigation(pendingNavigationRef.current, routePath);
    if (pendingStatus === "blocked" || pendingStatus === "match") return;

    let cancelled = false;

    void (async () => {
      const ctx = buildValidationContext(
        registryClientIds,
        posts,
        canvaPages,
        planningPeriodIds,
        planningPeriods,
        activePlanningPeriodId,
        activeCanvaPageId,
        true
      );
      const validated = validateClientRoute(clientRoute, ctx);
      const route = validated.route;

      if (cancelled) return;
      if (!validated.ok) return;

      const stateRoute = currentRouteFromState();
      if (!stateRoute) return;

      if (buildClientPath(route, routeBuildCtx) === buildClientPath(stateRoute, routeBuildCtx)) {
        return;
      }

      if (pathsEqual(route, stateRoute, routeBuildCtx)) {
        return;
      }

      if (
        activeSectionRef.current === "settings" &&
        settingsDraftDirtyRef.current &&
        route.section !== "settings"
      ) {
        const ok = await confirmDialog({
          title: "Alterações não salvas",
          message:
            "Você tem alterações no Gem da marca que ainda não foram salvas. Sair sem salvar?",
          variant: "danger",
          confirmLabel: "Sair sem salvar",
        });
        if (cancelled) return;
        if (!ok) {
          const revertRoute = currentRouteFromState();
          if (revertRoute) {
            void commitNavigation(revertRoute, {
              replace: true,
              skipDirtyGuard: true,
            });
          }
          return;
        }
      }

      void commitNavigation(stateRoute, { replace: true, skipDirtyGuard: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    clientRoute,
    hasActiveClient,
    effectiveActiveClientId,
    activeSection,
    postsWorkTab,
    catalogTab,
    settingsTab,
    activePreviewId,
    activeCanvaPageId,
    selectedCanvaSlotId,
    activePlanningPeriodId,
    registryClientIds,
    posts,
    canvaPages,
    planningPeriodIds,
    planningPeriods,
    commitNavigation,
    currentRouteFromState,
    routeBuildCtx,
    pendingNavigationRef,
    isApplyingRouteRef,
  ]);

  const handleNavigate = useCallback(
    (section: AppSection) => void commitNavigation({ section }),
    [commitNavigation]
  );

  const handlePostsWorkTabChange = useCallback(
    (tab: PostsWorkTab) => {
      void commitNavigation({ section: "posts", postsTab: tab, postId: undefined });
    },
    [commitNavigation]
  );

  const handleCatalogTabChange = useCallback(
    (tab: CatalogTab) => {
      void commitNavigation({ section: "catalog", catalogTab: tab });
    },
    [commitNavigation]
  );

  const handleSettingsTabChange = useCallback(
    (tab: SettingsTab) => {
      void commitNavigation({ section: "settings", settingsTab: tab });
    },
    [commitNavigation]
  );

  const selectPreviewPost = useCallback(
    (postId: string) => {
      void commitNavigation({
        section: "posts",
        postsTab: "day",
        postId,
      });
    },
    [commitNavigation]
  );

  const selectCanvaPage = useCallback(
    (pageId: string) => {
      void commitNavigation({
        section: "canva_grid",
        pageId,
        slotId: undefined,
      });
    },
    [commitNavigation]
  );

  const selectCanvaSlot = useCallback(
    (slotId: string | null) => {
      void commitNavigation({
        section: "canva_grid",
        pageId: activeCanvaPageId,
        slotId: slotId ?? undefined,
      });
    },
    [commitNavigation, activeCanvaPageId]
  );

  const navigateToClientSettings = useCallback(
    (clientId: string) => {
      void commitNavigation({
        clientId,
        section: "settings",
        settingsTab: "brand",
      });
    },
    [commitNavigation]
  );

  return {
    handleNavigate,
    handlePostsWorkTabChange,
    handleCatalogTabChange,
    handleSettingsTabChange,
    selectPreviewPost,
    selectCanvaPage,
    selectCanvaSlot,
    navigateToClientSettings,
    navigateClient: commitNavigation,
  };
}
