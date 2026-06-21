"use client";

import { useCallback, useEffect, useRef } from "react";
import { confirmDialog } from "../lib/confirmDialog";
import {
  clientRouteToStatePatch,
  pathsEqual,
  postsTabToViewMode,
  stateToClientRoute,
  useAppNavigation,
  validateClientRoute,
  type CatalogTab,
  type ClientRoute,
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
  activeClientId: string;
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
  defaultPageId?: string
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
  };
}

export function useAppRouteSync({
  enabled,
  hasActiveClient,
  activeClientId,
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
    navigateClient,
    navigateSection,
    replaceClientRoute,
    setBeforeNavigate,
    isApplyingRouteRef,
  } = useAppNavigation();

  const applyingFromUrlRef = useRef(false);
  const routeInitializedRef = useRef(false);

  useEffect(() => {
    routeInitializedRef.current = false;
  }, [pathname]);

  const currentRouteFromState = useCallback(
    () =>
      stateToClientRoute({
        clientId: activeClientId,
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
      activeClientId,
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

  useEffect(() => {
    setBeforeNavigate(async (next: ClientRoute) => {
      if (
        activeSection === "settings" &&
        settingsDraftDirty &&
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
  }, [activeSection, settingsDraftDirty, setBeforeNavigate]);

  useEffect(() => {
    if (!enabled || !clientRoute || !hasActiveClient) return;
    if (isApplyingRouteRef.current) return;

    let cancelled = false;

    void (async () => {
      const ctx = buildValidationContext(
        registryClientIds,
        posts,
        canvaPages,
        activeCanvaPageId
      );
      const validated = validateClientRoute(clientRoute, ctx);
      const route = validated.route;

      if (cancelled) return;

      if (!validated.ok) {
        replaceClientRoute(route);
        return;
      }

      if (route.clientId !== activeClientId) {
        handlers.switchClient(route.clientId);
        return;
      }

      if (pathsEqual(route, currentRouteFromState())) {
        routeInitializedRef.current = true;
        return;
      }

      if (
        activeSection === "settings" &&
        settingsDraftDirty &&
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
          void navigateClient(currentRouteFromState(), {
            replace: true,
            skipDirtyGuard: true,
          });
          return;
        }
      }

      applyPatch(clientRouteToStatePatch(route));
      routeInitializedRef.current = true;
    })();

    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    clientRoute,
    hasActiveClient,
    activeClientId,
    activeSection,
    settingsDraftDirty,
    registryClientIds,
    posts,
    canvaPages,
    activeCanvaPageId,
    replaceClientRoute,
    applyPatch,
    handlers,
    isApplyingRouteRef,
    currentRouteFromState,
    navigateClient,
  ]);

  useEffect(() => {
    if (!enabled || !hasActiveClient || !activeClientId) return;
    if (!routeInitializedRef.current) return;
    if (applyingFromUrlRef.current || isApplyingRouteRef.current) return;

    const routeFromState = currentRouteFromState();
    if (clientRoute && pathsEqual(routeFromState, clientRoute)) return;

    void navigateClient(routeFromState, { replace: true, skipDirtyGuard: true });
  }, [
    enabled,
    hasActiveClient,
    activeClientId,
    clientRoute,
    currentRouteFromState,
    navigateClient,
    isApplyingRouteRef,
  ]);

  const handleNavigate = useCallback(
    (section: AppSection) => navigateSection(section),
    [navigateSection]
  );

  const handlePostsWorkTabChange = useCallback(
    (tab: PostsWorkTab) => {
      void navigateClient({ section: "posts", postsTab: tab, postId: undefined });
    },
    [navigateClient]
  );

  const handleCatalogTabChange = useCallback(
    (tab: CatalogTab) => {
      void navigateClient({ section: "catalog", catalogTab: tab });
    },
    [navigateClient]
  );

  const handleSettingsTabChange = useCallback(
    (tab: SettingsTab) => {
      void navigateClient({ section: "settings", settingsTab: tab });
    },
    [navigateClient]
  );

  const selectPreviewPost = useCallback(
    (postId: string) => {
      void navigateClient({
        section: "posts",
        postsTab: "day",
        postId,
      });
    },
    [navigateClient]
  );

  const selectCanvaPage = useCallback(
    (pageId: string) => {
      void navigateClient({
        section: "canva_grid",
        pageId,
        slotId: undefined,
      });
    },
    [navigateClient]
  );

  const selectCanvaSlot = useCallback(
    (slotId: string | null) => {
      void navigateClient({
        section: "canva_grid",
        pageId: activeCanvaPageId,
        slotId: slotId ?? undefined,
      });
    },
    [navigateClient, activeCanvaPageId]
  );

  const navigateToClientSettings = useCallback(
    (clientId: string) => {
      void navigateClient({
        clientId,
        section: "settings",
        settingsTab: "brand",
      });
    },
    [navigateClient]
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
    navigateClient,
  };
}
