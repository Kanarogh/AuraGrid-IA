"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { AppSection } from "../components/layout/AppSidebar";
import { aiQueue } from "../lib/aiQueue";
import type { CanvaGridFormatId } from "../lib/canvaGridFormats";
import { getCanvaGridFormat } from "../lib/canvaGridFormats";
import { setCaptionCacheClientId, setApiCaptionCacheEnabled } from "../lib/captionCache";
import { normalizeCatalogItem } from "../lib/catalog";
import {
  createClientMeta,
  createEmptyWorkspace,
  createOrphanWorkspace,
  createEmptyRegistry,
  ensureClientRegistry,
  loadWorkspace,
  resolveWorkspaceForClient,
  saveRegistry,
  saveWorkspace,
  saveWorkspaceResilient,
  deleteWorkspace,
  clearClientCaptionCache,
  uniqueClientId,
  slugifyClientName,
  type ClientMeta,
  type ClientRegistry,
  type ClientWorkspace,
} from "../lib/clientWorkspace";
import { notifyStorageSaveFailure } from "../lib/clientWorkspace/saveNotify";
import { toast } from "../lib/toast";
import type { BrandGem, CanvaGridPage, CatalogItem, PlannedPost } from "../types";
import { useAuth, getCachedAuthBootstrap } from "./AuthContext";
import { isStorageModeResolved, resolveInitialStorageMode } from "../lib/storageMode";
import { getApiHelpers, type ApiRegistryEvent } from "./ApiWorkspaceSync";
import {
  activatePlanningPeriodApi,
  apiWorkspaceToClientWorkspace,
  createPlanningPeriodApi,
  fetchRegistry,
  fetchWorkspace,
  renameClientApi,
  saveBrandGemApi,
} from "../lib/api/workspaceApi";
import { broadcastSyncChanged } from "../lib/sync/broadcast";
import { markLocalSync } from "../lib/sync/localSyncAck";
import { classifyPeriodsRemoteChange } from "../lib/sync/periodsRevision";
import {
  beginRemoteWorkspaceApply,
  endRemoteWorkspaceApply,
  markWorkspacePatchSynced,
} from "../lib/sync/remoteApplyGuard";
import { workspaceApiPatchFingerprint } from "../lib/clientWorkspace/apiWorkspacePatch";
import {
  createLocalPlanningPeriod,
  editArchivedLocalPlanningPeriod,
  persistActivePeriodSnapshot,
  reactivateLocalPlanningPeriod,
  resetLocalActivePeriod,
  switchLocalPlanningPeriod,
  viewLocalPlanningPeriod,
} from "../lib/clientWorkspace/planningPeriodLocal";
import type { PlanningPeriod } from "../lib/planningConstants";
import type { PlanningPeriodEditMode } from "../lib/clientWorkspace/types";

type ClientWorkspaceContextValue = {
  registry: ClientRegistry;
  hasActiveClient: boolean;
  activeClientId: string;
  /** ID resolvido para routing: activeClientId válido ou primeiro cliente. */
  effectiveActiveClientId: string;
  activeClient: ClientMeta;
  clients: ClientMeta[];
  workspace: ClientWorkspace;
  setCatalog: Dispatch<SetStateAction<CatalogItem[]>>;
  setPosts: Dispatch<SetStateAction<PlannedPost[]>>;
  setStartDate: Dispatch<SetStateAction<string>>;
  setBrandGem: Dispatch<SetStateAction<BrandGem>>;
  setCanvaPages: Dispatch<SetStateAction<CanvaGridPage[]>>;
  setActiveCanvaPageId: Dispatch<SetStateAction<string>>;
  setAutoSyncCanva: Dispatch<SetStateAction<boolean>>;
  setCanvaGridReversed: Dispatch<SetStateAction<boolean>>;
  setCanvaGridFormat: (format: CanvaGridFormatId) => void;
  setCanvaGridMaxWidth: (width: number) => void;
  setUiPrefs: (partial: NonNullable<ClientWorkspace["ui"]>) => void;
  saveBrandGem: (gem: BrandGem) => Promise<string | null>;
  switchClient: (clientId: string) => void;
  createClient: (name: string, slug?: string) => string;
  renameClient: (clientId: string, name: string) => void;
  deleteClient: (clientId: string) => boolean;
  resetActiveClient: () => void;
  persistWorkspaceNow: () => Promise<void>;
  /** Leitura síncrona dos posts — evita closure desatualizado em lotes de legenda. */
  getPostsSnapshot: () => PlannedPost[];
  activePlanningPeriodId: string;
  planningPeriods: PlanningPeriod[];
  isReadOnly: boolean;
  periodEditMode: PlanningPeriodEditMode;
  switchPlanningPeriod: (periodId: string) => Promise<void>;
  viewPlanningPeriod: (periodId: string) => Promise<void>;
  reactivatePlanningPeriod: (periodId: string) => Promise<void>;
  editArchivedPlanningPeriod: (periodId: string) => Promise<void>;
  exitArchivedEdit: () => Promise<void>;
  createPlanningPeriod: (options: {
    label?: string;
    startDate?: string;
    sourcePeriodId?: string;
  }) => Promise<void>;
  duplicatePlanningPeriod: (
    sourcePeriodId: string,
    options?: { label?: string; startDate?: string }
  ) => Promise<void>;
  applyRemoteRegistry: () => Promise<void>;
  applyRemotePlanningPeriods: (ctx: {
    prevToken: string;
    nextToken: string;
  }) => Promise<void>;
  useApiStorage: boolean;
  workspaceHydrated: boolean;
};

const ClientWorkspaceContext = createContext<ClientWorkspaceContextValue | null>(null);

const SAVE_DEBOUNCE_MS = 300;

function touchMeta(meta: ClientMeta): ClientMeta {
  return { ...meta, updatedAt: new Date().toISOString() };
}

function withPeriodEditMode(
  ws: ClientWorkspace,
  mode?: PlanningPeriodEditMode
): ClientWorkspace {
  if (mode) {
    return {
      ...ws,
      periodEditMode: mode,
      isReadOnly: mode === "view_archived",
    };
  }
  const period = ws.planningPeriods.find((p) => p.id === ws.activePlanningPeriodId);
  const derived: PlanningPeriodEditMode =
    period?.status === "archived" ? "view_archived" : "active";
  return {
    ...ws,
    periodEditMode: ws.periodEditMode ?? derived,
    isReadOnly: (ws.periodEditMode ?? derived) === "view_archived",
  };
}
function initialWorkspace(reg: ClientRegistry): ClientWorkspace {
  if (reg.clients.length === 0) return createOrphanWorkspace();
  const meta =
    reg.clients.find((c) => c.id === reg.activeClientId) ?? reg.clients[0];
  if (!meta) return createOrphanWorkspace();
  return resolveWorkspaceForClient(reg.activeClientId, meta);
}

function seedRegistryFromLocal(): ClientRegistry {
  return ensureClientRegistry();
}

export function ClientWorkspaceProvider({ children }: { children: ReactNode }) {
  const { storageMode, user, loading: authLoading } = useAuth();
  const useApiStorage = storageMode === "postgresql" && !!user;
  const initialMode = resolveInitialStorageMode(getCachedAuthBootstrap()?.storageMode);
  const localSeededRef = useRef(initialMode === "local");

  const [registry, setRegistry] = useState<ClientRegistry>(() =>
    initialMode === "local" ? seedRegistryFromLocal() : createEmptyRegistry()
  );
  const [workspace, setWorkspace] = useState<ClientWorkspace>(() =>
    initialMode === "local"
      ? initialWorkspace(seedRegistryFromLocal())
      : createOrphanWorkspace()
  );
  const [workspaceHydrated, setWorkspaceHydrated] = useState(false);

  useEffect(() => {
    if (authLoading || !isStorageModeResolved(storageMode)) return;

    if (storageMode === "local") {
      if (!localSeededRef.current) {
        localSeededRef.current = true;
        const reg = seedRegistryFromLocal();
        setRegistry(reg);
        setWorkspace(initialWorkspace(reg));
      }
      setWorkspaceHydrated(true);
      return;
    }

    if (!user) {
      setWorkspaceHydrated(false);
      return;
    }

    setWorkspaceHydrated(false);
  }, [useApiStorage, user?.id, authLoading, storageMode, user]);

  useEffect(() => {
    if (!useApiStorage) return;
    const onApiRegistry = (e: Event) => {
      const { registry: reg, workspace: ws } = (e as CustomEvent<ApiRegistryEvent>).detail;
      const normalizedReg =
        reg.clients.length > 0 &&
        !reg.clients.some((c) => c.id === reg.activeClientId)
          ? { ...reg, activeClientId: reg.clients[0]!.id }
          : reg;
      setRegistry(normalizedReg);
      setWorkspace(ws);
      workspaceRef.current = ws;
      setWorkspaceHydrated(true);
    };
    window.addEventListener("auragrid:api-registry", onApiRegistry);
    return () => window.removeEventListener("auragrid:api-registry", onApiRegistry);
  }, [useApiStorage]);

  const hasActiveClient = registry.clients.length > 0;
  const activeClientId = hasActiveClient ? registry.activeClientId : "";
  const effectiveActiveClientId = useMemo(() => {
    if (!hasActiveClient) return "";
    if (registry.clients.some((c) => c.id === registry.activeClientId)) {
      return registry.activeClientId;
    }
    return registry.clients[0]?.id ?? "";
  }, [hasActiveClient, registry.activeClientId, registry.clients]);

  useEffect(() => {
    setCaptionCacheClientId(activeClientId);
    setApiCaptionCacheEnabled(useApiStorage);
  }, [activeClientId, useApiStorage]);
  const activeClient = useMemo(() => {
    const found = registry.clients.find((c) => c.id === activeClientId);
    if (found) return found;
    if (registry.clients[0]) return registry.clients[0];
    return createClientMeta("", "Nenhum cliente");
  }, [registry, activeClientId]);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workspaceRef = useRef(workspace);
  workspaceRef.current = workspace;

  const flushSave = useCallback((clientId: string, ws: ClientWorkspace) => {
    void saveWorkspaceResilient(clientId, persistActivePeriodSnapshot(ws)).then(
      notifyStorageSaveFailure
    );
  }, []);

  const persistWorkspaceNow = useCallback(async () => {
    if (!activeClientId) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (useApiStorage) {
      const deadline = Date.now() + 2500;
      let flush = getApiHelpers()?.flushWorkspaceNow;
      while (!flush && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 50));
        flush = getApiHelpers()?.flushWorkspaceNow;
      }
      if (!flush) {
        console.warn("[AuraGrid] API de persistência ainda não disponível.");
        toast.error("Não foi possível salvar na nuvem. Aguarde o carregamento e tente novamente.");
        return;
      }
      try {
        await flush(workspaceRef.current);
      } catch (err) {
        console.error("[AuraGrid] Falha ao salvar workspace:", err);
        toast.error("Não foi possível salvar o grid na nuvem.");
        throw err;
      }
      return;
    }
    flushSave(activeClientId, workspaceRef.current);
  }, [activeClientId, flushSave, useApiStorage]);

  const scheduleSave = useCallback(
    (clientId: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        flushSave(clientId, workspaceRef.current);
      }, SAVE_DEBOUNCE_MS);
    },
    [flushSave]
  );

  useEffect(() => {
    if (!activeClientId || useApiStorage) return;
    scheduleSave(activeClientId);
  }, [workspace, activeClientId, scheduleSave, useApiStorage]);

  useEffect(() => {
    if (!activeClientId || useApiStorage) return;
    const flushOnExit = () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      const ws = workspaceRef.current;
      const result = saveWorkspace(activeClientId, ws);
      if (result.ok === false && result.reason === "quota") {
        void saveWorkspaceResilient(activeClientId, ws);
      }
    };
    window.addEventListener("beforeunload", flushOnExit);
    window.addEventListener("pagehide", flushOnExit);
    return () => {
      window.removeEventListener("beforeunload", flushOnExit);
      window.removeEventListener("pagehide", flushOnExit);
    };
  }, [activeClientId, flushSave]);

  const persistRegistry = useCallback((next: ClientRegistry) => {
    setRegistry(next);
    saveRegistry(next);
  }, []);

  const loadClientIntoState = useCallback(
    (clientId: string, clients: ClientMeta[]) => {
      const meta = clients.find((c) => c.id === clientId);
      if (!meta) return;
      const ws = resolveWorkspaceForClient(clientId, meta);
      setWorkspace(ws);
      workspaceRef.current = ws;
      flushSave(clientId, ws);
    },
    [flushSave]
  );

  const switchClient = useCallback(
    (clientId: string) => {
      if (useApiStorage) {
        void (async () => {
          if (registry.activeClientId === clientId) return;
          const api = getApiHelpers();
          if (!api) return;
          if (registry.activeClientId) {
            const flush = api.flushWorkspaceNow;
            if (flush) await flush(workspaceRef.current);
          }
          aiQueue.cancelPending();
          await api.activateClient(clientId);
          const reg = await api.fetchRegistry();
          const dto = await api.fetchWorkspace(clientId);
          setRegistry(reg);
          const ws = api.toWorkspace(dto);
          setWorkspace(ws);
          workspaceRef.current = ws;
        })();
        return;
      }

      setRegistry((reg) => {
        if (clientId === reg.activeClientId) return reg;
        if (reg.activeClientId) flushSave(reg.activeClientId, workspaceRef.current);
        aiQueue.cancelPending();
        const next = { ...reg, activeClientId: clientId };
        saveRegistry(next);
        queueMicrotask(() => loadClientIntoState(clientId, next.clients));
        return next;
      });
    },
    [flushSave, loadClientIntoState, registry, useApiStorage]
  );

  const setCatalog: Dispatch<SetStateAction<CatalogItem[]>> = useCallback(
    (action) => {
      setWorkspace((prev) => {
        if (prev.isReadOnly) return prev;
        const nextCatalog =
          typeof action === "function"
            ? action(prev.catalog).map(normalizeCatalogItem)
            : action.map(normalizeCatalogItem);
        const next = { ...prev, catalog: nextCatalog };
        workspaceRef.current = next;

        if (activeClientId && !useApiStorage && nextCatalog.length !== prev.catalog.length) {
          if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
          }
          void saveWorkspaceResilient(activeClientId, next).then(notifyStorageSaveFailure);
        }

        return next;
      });
    },
    [activeClientId]
  );

  const setPosts: Dispatch<SetStateAction<PlannedPost[]>> = useCallback((action) => {
    setWorkspace((prev) => {
      if (prev.isReadOnly) return prev;
      const next: ClientWorkspace = {
        ...prev,
        posts: typeof action === "function" ? action(prev.posts) : action,
      };
      workspaceRef.current = next;
      return next;
    });
  }, []);

  const getPostsSnapshot = useCallback((): PlannedPost[] => {
    return workspaceRef.current.posts;
  }, []);

  const setStartDate: Dispatch<SetStateAction<string>> = useCallback((action) => {
    setWorkspace((prev) => {
      if (prev.isReadOnly) return prev;
      const nextStartDate = typeof action === "function" ? action(prev.startDate) : action;
      const next: ClientWorkspace = {
        ...prev,
        startDate: nextStartDate,
        planningPeriods: prev.planningPeriods.map((p) =>
          p.id === prev.activePlanningPeriodId
            ? { ...p, startDate: nextStartDate, updatedAt: new Date().toISOString() }
            : p
        ),
      };
      workspaceRef.current = next;
      return next;
    });
  }, []);

  const setBrandGem: Dispatch<SetStateAction<BrandGem>> = useCallback((action) => {
    setWorkspace((prev) => {
      if (prev.isReadOnly) return prev;
      const nextGem = typeof action === "function" ? action(prev.brandGem) : action;
      const next: ClientWorkspace = {
        ...prev,
        brandGem: { ...nextGem, id: prev.brandGem.id },
        planningPeriods: prev.planningPeriods.map((p) =>
          p.id === prev.activePlanningPeriodId
            ? {
                ...p,
                campaignContext: nextGem.campaignContext ?? "",
                updatedAt: new Date().toISOString(),
              }
            : p
        ),
      };
      workspaceRef.current = next;
      return next;
    });
  }, []);

  const setCanvaPages: Dispatch<SetStateAction<CanvaGridPage[]>> = useCallback(
    (action) => {
      setWorkspace((prev) => {
        if (prev.isReadOnly) return prev;
        const next: ClientWorkspace = {
          ...prev,
          canva: {
            ...prev.canva,
            pages: typeof action === "function" ? action(prev.canva.pages) : action,
          },
        };
        workspaceRef.current = next;
        return next;
      });
    },
    []
  );

  const setActiveCanvaPageId: Dispatch<SetStateAction<string>> = useCallback(
    (action) => {
      setWorkspace((prev) => {
        if (prev.isReadOnly) return prev;
        const next: ClientWorkspace = {
          ...prev,
          canva: {
            ...prev.canva,
            activePageId:
              typeof action === "function" ? action(prev.canva.activePageId) : action,
          },
        };
        workspaceRef.current = next;
        return next;
      });
    },
    []
  );

  const setAutoSyncCanva: Dispatch<SetStateAction<boolean>> = useCallback((action) => {
    setWorkspace((prev) => {
      if (prev.isReadOnly) return prev;
      return {
        ...prev,
        canva: {
          ...prev.canva,
          autoSync: typeof action === "function" ? action(prev.canva.autoSync) : action,
        },
      };
    });
  }, []);

  const setCanvaGridReversed: Dispatch<SetStateAction<boolean>> = useCallback(
    (action) => {
      setWorkspace((prev) => {
        if (prev.isReadOnly) return prev;
        return {
          ...prev,
          canva: {
            ...prev.canva,
            reversed: typeof action === "function" ? action(prev.canva.reversed) : action,
          },
        };
      });
    },
    []
  );

  const setCanvaGridFormat = useCallback((format: CanvaGridFormatId) => {
    const defaults = getCanvaGridFormat(format);
    setWorkspace((prev) => {
      if (prev.isReadOnly) return prev;
      return {
        ...prev,
        canva: {
          ...prev.canva,
          gridFormat: format,
          gridMaxWidth: defaults.defaultMaxWidth,
        },
      };
    });
  }, []);

  const setCanvaGridMaxWidth = useCallback((width: number) => {
    setWorkspace((prev) => {
      if (prev.isReadOnly) return prev;
      const format = getCanvaGridFormat(prev.canva.gridFormat);
      const clamped = Math.min(format.zoomMax, Math.max(format.zoomMin, width));
      return {
        ...prev,
        canva: { ...prev.canva, gridMaxWidth: clamped },
      };
    });
  }, []);

  const setUiPrefs = useCallback((partial: NonNullable<ClientWorkspace["ui"]>) => {
    setWorkspace((prev) => ({
      ...prev,
      ui: { ...prev.ui, ...partial },
    }));
  }, []);

  const saveBrandGem = useCallback(
    async (gem: BrandGem): Promise<string | null> => {
      if (!activeClientId) return null;
      if (workspaceRef.current.isReadOnly) {
        toast.error("Roteiro arquivado é somente leitura.");
        return null;
      }
      const normalized: BrandGem = { ...gem, id: activeClientId };
      const trimmedName = normalized.name.trim() || activeClientId;

      if (!useApiStorage) {
        const savedAt = new Date().toISOString();
        setWorkspace((prev) => {
          const next: ClientWorkspace = {
            ...prev,
            brandGem: normalized,
            ui: { ...prev.ui, brandGemSavedAt: savedAt },
          };
          workspaceRef.current = next;
          if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
          saveWorkspace(activeClientId, next);
          return next;
        });
        setRegistry((prev) => ({
          ...prev,
          clients: prev.clients.map((c) =>
            c.id === activeClientId ? touchMeta({ ...c, name: trimmedName }) : c
          ),
        }));
        return savedAt;
      }

      try {
        const { savedAt } = await saveBrandGemApi(activeClientId, normalized);
        setWorkspace((prev) => {
          const next: ClientWorkspace = {
            ...prev,
            brandGem: normalized,
            ui: { ...prev.ui, brandGemSavedAt: savedAt },
          };
          workspaceRef.current = next;
          return next;
        });
        setRegistry((prev) => ({
          ...prev,
          clients: prev.clients.map((c) =>
            c.id === activeClientId ? touchMeta({ ...c, name: trimmedName }) : c
          ),
        }));
        broadcastSyncChanged(activeClientId, ["brandGem"]);
        return savedAt;
      } catch (err) {
        console.error("[AuraGrid] Falha ao salvar Gem na nuvem:", err);
        toast.error("Não foi possível salvar o Gem na nuvem. Tente novamente.");
        return null;
      }
    },
    [activeClientId, useApiStorage]
  );

  const createClient = useCallback(
    (name: string, slug?: string): string => {
      if (useApiStorage) {
        let createdId = "";
        void (async () => {
          const api = getApiHelpers();
          if (!api) return;
          if (registry.activeClientId) {
            const flush = api.flushWorkspaceNow;
            if (flush) await flush(workspaceRef.current);
          }
          aiQueue.cancelPending();
          const created = await api.createClient(name, slug);
          createdId = created.id;
          await api.activateClient(created.id);
          const reg = await api.fetchRegistry();
          const dto = await api.fetchWorkspace(created.id);
          setRegistry(reg);
          const ws = api.toWorkspace(dto);
          setWorkspace(ws);
          workspaceRef.current = ws;
          broadcastSyncChanged(created.id, ["registry"]);
        })();
        return slug?.trim() || slugifyClientName(name);
      }

      const reg = registry;
      const base = slug?.trim() || slugifyClientName(name);
      const id = uniqueClientId(base, reg.clients.map((c) => c.id));
      const meta = createClientMeta(id, name);
      const ws = createEmptyWorkspace(meta);
      saveWorkspace(id, ws);
      if (reg.activeClientId) flushSave(reg.activeClientId, workspaceRef.current);
      aiQueue.cancelPending();
      const next: ClientRegistry = {
        ...reg,
        activeClientId: id,
        clients: [...reg.clients, meta],
      };
      setRegistry(next);
      saveRegistry(next);
      loadClientIntoState(id, next.clients);
      return id;
    },
    [registry, flushSave, loadClientIntoState, useApiStorage]
  );

  const renameClient = useCallback(
    (clientId: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      if (useApiStorage) {
        void (async () => {
          try {
            await renameClientApi(clientId, trimmed);
            const reg = await fetchRegistry();
            setRegistry(reg);
            if (clientId === activeClientId) {
              setBrandGem((g) => ({ ...g, name: trimmed }));
            }
            broadcastSyncChanged(clientId, ["registry"]);
          } catch (err) {
            console.error("[AuraGrid] Falha ao renomear cliente:", err);
            toast.error("Não foi possível renomear o cliente na nuvem.");
          }
        })();
        return;
      }
      const nextClients = registry.clients.map((c) =>
        c.id === clientId ? touchMeta({ ...c, name: trimmed }) : c
      );
      persistRegistry({ ...registry, clients: nextClients });
      if (clientId === activeClientId) {
        setBrandGem((g) => ({ ...g, name: trimmed }));
      } else {
        const ws = loadWorkspace(clientId);
        if (ws) {
          ws.brandGem.name = trimmed;
          saveWorkspace(clientId, ws);
        }
      }
    },
    [registry, activeClientId, persistRegistry, setBrandGem, useApiStorage]
  );

  const deleteClient = useCallback(
    (clientId: string) => {
      if (useApiStorage) {
        void (async () => {
          const api = getApiHelpers();
          if (!api) return;
          await api.deleteClient(clientId);
          const reg = await api.fetchRegistry();
          setRegistry(reg);
          const nextId = reg.activeClientId || reg.clients[0]?.id;
          if (nextId) {
            const dto = await api.fetchWorkspace(nextId);
            const ws = api.toWorkspace(dto);
            setWorkspace(ws);
            workspaceRef.current = ws;
          } else {
            const orphan = createOrphanWorkspace();
            setWorkspace(orphan);
            workspaceRef.current = orphan;
          }
          broadcastSyncChanged(clientId, ["registry"]);
          aiQueue.cancelPending();
        })();
        return true;
      }

      if (!registry.clients.some((c) => c.id === clientId)) return false;
      deleteWorkspace(clientId);
      clearClientCaptionCache(clientId);
      const nextClients = registry.clients.filter((c) => c.id !== clientId);
      if (nextClients.length === 0) {
        const orphan = createOrphanWorkspace();
        persistRegistry({ version: 1, activeClientId: "", clients: [] });
        setWorkspace(orphan);
        workspaceRef.current = orphan;
        aiQueue.cancelPending();
        return true;
      }
      const nextActive =
        clientId === activeClientId ? nextClients[0]!.id : activeClientId;
      persistRegistry({ ...registry, clients: nextClients, activeClientId: nextActive });
      if (clientId === activeClientId) {
        loadClientIntoState(nextActive, nextClients);
      }
      return true;
    },
    [registry, activeClientId, persistRegistry, loadClientIntoState, useApiStorage]
  );

  const switchPlanningPeriod = useCallback(
    async (periodId: string) => {
      if (!activeClientId) return;
      const current = workspaceRef.current;
      if (
        periodId === current.activePlanningPeriodId &&
        current.periodEditMode !== "view_archived"
      ) {
        return;
      }

      const period = current.planningPeriods.find((p) => p.id === periodId);
      if (!period) return;

      if (period.status === "archived") {
        if (useApiStorage) {
          try {
            markLocalSync(activeClientId, ["periods", "workspace"]);
            const dto = await fetchWorkspace(activeClientId, periodId);
            const ws = withPeriodEditMode(apiWorkspaceToClientWorkspace(dto), "view_archived");
            beginRemoteWorkspaceApply();
            try {
              setWorkspace(ws);
              workspaceRef.current = ws;
              const fp = workspaceApiPatchFingerprint(ws);
              if (fp) markWorkspacePatchSynced(activeClientId, fp);
            } finally {
              endRemoteWorkspaceApply();
            }
          } catch (err) {
            console.error("[AuraGrid] Falha ao visualizar roteiro:", err);
            toast.error("Não foi possível carregar o roteiro.");
          }
          return;
        }

        const next = viewLocalPlanningPeriod(current, periodId);
        setWorkspace(next);
        workspaceRef.current = next;
        flushSave(activeClientId, next);
        return;
      }

      if (useApiStorage) {
        try {
          markLocalSync(activeClientId, ["periods", "workspace"]);
          const dto = await fetchWorkspace(activeClientId, periodId);
          const ws = withPeriodEditMode(apiWorkspaceToClientWorkspace(dto), "active");
          beginRemoteWorkspaceApply();
          try {
            setWorkspace(ws);
            workspaceRef.current = ws;
            const fp = workspaceApiPatchFingerprint(ws);
            if (fp) markWorkspacePatchSynced(activeClientId, fp);
          } finally {
            endRemoteWorkspaceApply();
          }
        } catch (err) {
          console.error("[AuraGrid] Falha ao trocar roteiro:", err);
          toast.error("Não foi possível carregar o roteiro.");
        }
        return;
      }

      const next = withPeriodEditMode(switchLocalPlanningPeriod(current, periodId), "active");
      setWorkspace(next);
      workspaceRef.current = next;
      flushSave(activeClientId, next);
    },
    [activeClientId, flushSave, useApiStorage]
  );

  const viewPlanningPeriod = useCallback(
    async (periodId: string) => {
      if (!activeClientId) return;
      const period = workspaceRef.current.planningPeriods.find((p) => p.id === periodId);
      if (!period || period.status !== "archived") {
        await switchPlanningPeriod(periodId);
        return;
      }

      if (useApiStorage) {
        try {
          markLocalSync(activeClientId, ["periods", "workspace"]);
          const dto = await fetchWorkspace(activeClientId, periodId);
          const ws = withPeriodEditMode(apiWorkspaceToClientWorkspace(dto), "view_archived");
          beginRemoteWorkspaceApply();
          try {
            setWorkspace(ws);
            workspaceRef.current = ws;
            const fp = workspaceApiPatchFingerprint(ws);
            if (fp) markWorkspacePatchSynced(activeClientId, fp);
          } finally {
            endRemoteWorkspaceApply();
          }
        } catch (err) {
          console.error("[AuraGrid] Falha ao visualizar roteiro:", err);
          toast.error("Não foi possível carregar o roteiro.");
        }
        return;
      }

      const next = viewLocalPlanningPeriod(workspaceRef.current, periodId);
      setWorkspace(next);
      workspaceRef.current = next;
      flushSave(activeClientId, next);
    },
    [activeClientId, flushSave, switchPlanningPeriod, useApiStorage]
  );

  const reactivatePlanningPeriod = useCallback(
    async (periodId: string) => {
      if (!activeClientId) return;
      const current = workspaceRef.current;
      if (
        periodId === current.activePlanningPeriodId &&
        current.periodEditMode !== "view_archived" &&
        current.periodEditMode !== "edit_archived"
      ) {
        return;
      }

      if (useApiStorage) {
        try {
          markLocalSync(activeClientId, ["periods", "workspace"]);
          const { workspace: dto } = await activatePlanningPeriodApi(activeClientId, periodId);
          const ws = withPeriodEditMode(apiWorkspaceToClientWorkspace(dto), "active");
          beginRemoteWorkspaceApply();
          try {
            setWorkspace(ws);
            workspaceRef.current = ws;
            const fp = workspaceApiPatchFingerprint(ws);
            if (fp) markWorkspacePatchSynced(activeClientId, fp);
          } finally {
            endRemoteWorkspaceApply();
          }
          broadcastSyncChanged(activeClientId, ["periods", "workspace"]);
        } catch (err) {
          console.error("[AuraGrid] Falha ao reativar roteiro:", err);
          toast.error("Não foi possível reativar o roteiro.");
        }
        return;
      }

      const next = reactivateLocalPlanningPeriod(current, periodId);
      setWorkspace(next);
      workspaceRef.current = next;
      flushSave(activeClientId, next);
    },
    [activeClientId, flushSave, useApiStorage]
  );

  const editArchivedPlanningPeriod = useCallback(
    async (periodId: string) => {
      if (!activeClientId) return;
      const period = workspaceRef.current.planningPeriods.find((p) => p.id === periodId);
      if (!period || period.status !== "archived") return;

      if (useApiStorage) {
        try {
          markLocalSync(activeClientId, ["periods", "workspace"]);
          const dto = await fetchWorkspace(activeClientId, periodId);
          const ws = withPeriodEditMode(apiWorkspaceToClientWorkspace(dto), "edit_archived");
          beginRemoteWorkspaceApply();
          try {
            setWorkspace(ws);
            workspaceRef.current = ws;
            const fp = workspaceApiPatchFingerprint(ws);
            if (fp) markWorkspacePatchSynced(activeClientId, fp);
          } finally {
            endRemoteWorkspaceApply();
          }
        } catch (err) {
          console.error("[AuraGrid] Falha ao editar roteiro arquivado:", err);
          toast.error("Não foi possível carregar o roteiro para edição.");
        }
        return;
      }

      const next = editArchivedLocalPlanningPeriod(workspaceRef.current, periodId);
      setWorkspace(next);
      workspaceRef.current = next;
      flushSave(activeClientId, next);
    },
    [activeClientId, flushSave, useApiStorage]
  );

  const exitArchivedEdit = useCallback(async () => {
    const current = workspaceRef.current;
    if (current.periodEditMode !== "edit_archived") return;
    await viewPlanningPeriod(current.activePlanningPeriodId);
  }, [viewPlanningPeriod]);

  const createPlanningPeriod = useCallback(
    async (options: { label?: string; startDate?: string; sourcePeriodId?: string }) => {
      if (!activeClientId) return;

      if (useApiStorage) {
        try {
          const api = getApiHelpers();
          if (
            api?.flushWorkspaceNow &&
            (!workspaceRef.current.isReadOnly ||
              workspaceRef.current.periodEditMode === "edit_archived")
          ) {
            await api.flushWorkspaceNow(workspaceRef.current);
          }
          const { workspace: dto } = await createPlanningPeriodApi(activeClientId, options);
          const ws = api ? api.toWorkspace(dto) : apiWorkspaceToClientWorkspace(dto);
          setWorkspace(ws);
          workspaceRef.current = ws;
          broadcastSyncChanged(activeClientId, ["periods", "workspace"]);
          toast.success("Novo roteiro criado.");
        } catch (err) {
          console.error("[AuraGrid] Falha ao criar roteiro:", err);
          toast.error("Não foi possível criar o roteiro.");
        }
        return;
      }

      const next = createLocalPlanningPeriod(workspaceRef.current, activeClient, options);
      setWorkspace(next);
      workspaceRef.current = next;
      flushSave(activeClientId, next);
      toast.success("Novo roteiro criado.");
    },
    [activeClient, activeClientId, flushSave, useApiStorage]
  );

  const duplicatePlanningPeriod = useCallback(
    async (
      sourcePeriodId: string,
      options: { label?: string; startDate?: string } = {}
    ) => {
      await createPlanningPeriod({ ...options, sourcePeriodId });
    },
    [createPlanningPeriod]
  );

  const applyRemoteRegistry = useCallback(async () => {
    if (!useApiStorage) return;
    const remote = await fetchRegistry();
    setRegistry((prev) => ({
      ...remote,
      activeClientId:
        prev.activeClientId && remote.clients.some((c) => c.id === prev.activeClientId)
          ? prev.activeClientId
          : remote.activeClientId || remote.clients[0]?.id || "",
    }));
  }, [useApiStorage]);

  const applyRemotePlanningPeriods = useCallback(
    async (ctx: { prevToken: string; nextToken: string }) => {
      if (!useApiStorage || !activeClientId) return;
      beginRemoteWorkspaceApply();
      try {
        const kind = classifyPeriodsRemoteChange(ctx.prevToken, ctx.nextToken);
        const dto = await fetchWorkspace(activeClientId);
        const ws = apiWorkspaceToClientWorkspace(dto);

        const preserveLocalWorkspace =
          workspaceRef.current.isReadOnly ||
          workspaceRef.current.periodEditMode === "edit_archived";

        if (kind === "activeSwitch") {
          if (preserveLocalWorkspace) {
            setWorkspace((prev) => ({ ...prev, planningPeriods: ws.planningPeriods }));
          } else if (ws.activePlanningPeriodId !== workspaceRef.current.activePlanningPeriodId) {
            setWorkspace(ws);
            workspaceRef.current = ws;
          }
        } else {
          setWorkspace((prev) => ({ ...prev, planningPeriods: ws.planningPeriods }));
        }

        const fp = workspaceApiPatchFingerprint(ws);
        if (fp) markWorkspacePatchSynced(activeClientId, fp);
      } finally {
        endRemoteWorkspaceApply();
      }
    },
    [activeClientId, useApiStorage]
  );

  const resetActiveClient = useCallback(() => {
    if (!hasActiveClient) return;
    if (useApiStorage) {
      void (async () => {
        try {
          const api = getApiHelpers();
          if (!api) return;
          const dto = await api.resetClient(activeClientId);
          const ws = api.toWorkspace(dto);
          setWorkspace(ws);
          workspaceRef.current = ws;
          broadcastSyncChanged(activeClientId, [
            "catalog",
            "workspace",
            "brandGem",
            "periods",
          ]);
          toast.success("Cliente resetado na nuvem.");
        } catch (err) {
          console.error("[AuraGrid] Falha ao resetar cliente:", err);
          toast.error("Não foi possível resetar o cliente na nuvem.");
        }
      })();
      return;
    }
    const meta = activeClient;
    const ws = resetLocalActivePeriod(workspaceRef.current, meta);
    setWorkspace(ws);
    workspaceRef.current = ws;
    flushSave(activeClientId, ws);
    clearClientCaptionCache(activeClientId);
  }, [activeClient, activeClientId, flushSave, hasActiveClient, useApiStorage]);

  const value = useMemo(
    (): ClientWorkspaceContextValue => ({
      registry,
      hasActiveClient,
      activeClientId,
      effectiveActiveClientId,
      activeClient,
      clients: registry.clients,
      workspace,
      setCatalog,
      setPosts,
      setStartDate,
      setBrandGem,
      setCanvaPages,
      setActiveCanvaPageId,
      setAutoSyncCanva,
      setCanvaGridReversed,
      setCanvaGridFormat,
      setCanvaGridMaxWidth,
      setUiPrefs,
      saveBrandGem,
      switchClient,
      createClient,
      renameClient,
      deleteClient,
      resetActiveClient,
      persistWorkspaceNow,
      getPostsSnapshot,
      activePlanningPeriodId: workspace.activePlanningPeriodId,
      planningPeriods: workspace.planningPeriods,
      isReadOnly: workspace.isReadOnly ?? false,
      periodEditMode: workspace.periodEditMode ?? "active",
      switchPlanningPeriod,
      viewPlanningPeriod,
      reactivatePlanningPeriod,
      editArchivedPlanningPeriod,
      exitArchivedEdit,
      createPlanningPeriod,
      duplicatePlanningPeriod,
      applyRemoteRegistry,
      applyRemotePlanningPeriods,
      useApiStorage,
      workspaceHydrated,
    }),
    [
      registry,
      hasActiveClient,
      activeClientId,
      effectiveActiveClientId,
      activeClient,
      workspace,
      setCatalog,
      setPosts,
      setStartDate,
      setBrandGem,
      setCanvaPages,
      setActiveCanvaPageId,
      setAutoSyncCanva,
      setCanvaGridReversed,
      setCanvaGridFormat,
      setCanvaGridMaxWidth,
      setUiPrefs,
      saveBrandGem,
      switchClient,
      createClient,
      renameClient,
      deleteClient,
      resetActiveClient,
      persistWorkspaceNow,
      getPostsSnapshot,
      switchPlanningPeriod,
      viewPlanningPeriod,
      reactivatePlanningPeriod,
      editArchivedPlanningPeriod,
      exitArchivedEdit,
      createPlanningPeriod,
      duplicatePlanningPeriod,
      applyRemoteRegistry,
      applyRemotePlanningPeriods,
      useApiStorage,
      workspaceHydrated,
    ]
  );

  return (
    <ClientWorkspaceContext.Provider value={value}>{children}</ClientWorkspaceContext.Provider>
  );
}

export function useClientWorkspace(): ClientWorkspaceContextValue {
  const ctx = useContext(ClientWorkspaceContext);
  if (!ctx) {
    throw new Error("useClientWorkspace deve ser usado dentro de ClientWorkspaceProvider");
  }
  return ctx;
}

/** Atalhos derivados do workspace ativo */
export function useWorkspaceData() {
  const { workspace, setUiPrefs } = useClientWorkspace();
  return {
    catalog: workspace.catalog,
    posts: workspace.posts,
    startDate: workspace.startDate,
    brandGem: workspace.brandGem,
    activePlanningPeriodId: workspace.activePlanningPeriodId,
    planningPeriods: workspace.planningPeriods,
    isReadOnly: workspace.isReadOnly ?? false,
    canvaPages: workspace.canva.pages,
    activeCanvaPageId: workspace.canva.activePageId,
    autoSyncCanva: workspace.canva.autoSync,
    canvaGridReversed: workspace.canva.reversed,
    canvaGridFormat: workspace.canva.gridFormat ?? "square",
    canvaGridMaxWidth: workspace.canva.gridMaxWidth ?? 320,
    ui: workspace.ui,
    setUiPrefs,
  };
}

export function usePersistedUiSection(
  activeSection: AppSection,
  setActiveSection: (s: AppSection) => void
) {
  const { workspace, setUiPrefs } = useClientWorkspace();
  const restored = useRef(false);

  useEffect(() => {
    if (!restored.current && workspace.ui?.activeSection) {
      setActiveSection(workspace.ui.activeSection);
      restored.current = true;
    }
  }, [workspace.ui?.activeSection, setActiveSection]);

  useEffect(() => {
    setUiPrefs({ activeSection });
  }, [activeSection, setUiPrefs]);
}
