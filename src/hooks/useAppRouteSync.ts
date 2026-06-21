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
  posts: PlannedPost[];
  canvaPages: CanvaGridPage[];
  handlers: AppRouteSyncHandlers;
};

function buildValidationContext(
  registryClientIds: string[],
  posts: PlannedPost[],
  canvaPages: CanvaGridPage[],
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
    slotIdsByPage,
    defaultPageId,
    workspaceReady,
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
    isApplyingRouteRef,
  } = useAppNavigation();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const applyingFromUrlRef = useRef(false);
  const activeSectionRef = useRef(activeSection);
  const settingsDraftDirtyRef = useRef(settingsDraftDirty);
  activeSectionRef.current = activeSection;
  settingsDraftDirtyRef.current = settingsDraftDirty;

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
        activeCanvaPageId,
        clientRoute?.clientId === effectiveActiveClientId
      );
      const nextRoute = enrichRouteBeforePush(built, activeCanvaPageId, ctx);
      const nextPath = buildClientPath(nextRoute);
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
      activeCanvaPageId,
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
    if (!enabled || !clientRoute || !hasActiveClient) return;
    if (applyingFromUrlRef.current) return;
    if (isApplyingRouteRef.current) return;

    const routePath = buildClientPath(clientRoute);
    const pendingStatus = resolvePendingNavigation(pendingNavigationRef.current, routePath);

    if (pendingStatus === "blocked") {
      return;
    }

    if (pendingStatus === "match") {
      pendingNavigationRef.current = null;
      const ctx = buildValidationContext(
        registryClientIds,
        posts,
        canvaPages,
        activeCanvaPageId,
        clientRoute.clientId === effectiveActiveClientId
      );
      const validated = validateClientRoute(clientRoute, ctx);
      const route = validated.route;
      if (route.clientId !== effectiveActiveClientId) {
        handlers.switchClient(route.clientId);
      }
      applyPatch(clientRouteToStatePatch(route));
      return;
    }

    let cancelled = false;

    void (async () => {
      const workspaceReady = clientRoute.clientId === effectiveActiveClientId;
      const ctx = buildValidationContext(
        registryClientIds,
        posts,
        canvaPages,
        activeCanvaPageId,
        workspaceReady
      );
      const validated = validateClientRoute(clientRoute, ctx);
      const route = validated.route;

      if (cancelled) return;

      if (!validated.ok) {
        replaceClientRoute(route);
        return;
      }

      if (route.clientId !== effectiveActiveClientId) {
        handlers.switchClient(route.clientId);
      }

      const stateRoute = currentRouteFromState();
      if (!stateRoute) return;

      if (buildClientPath(route) === buildClientPath(stateRoute)) {
        return;
      }

      if (pathsEqual(route, stateRoute)) {
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

      applyPatch(clientRouteToStatePatch(route));
    })();

    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    pathname,
    searchParams,
    clientRoute,
    hasActiveClient,
    effectiveActiveClientId,
    registryClientIds,
    posts,
    canvaPages,
    activeCanvaPageId,
    replaceClientRoute,
    applyPatch,
    handlers,
    currentRouteFromState,
    commitNavigation,
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
