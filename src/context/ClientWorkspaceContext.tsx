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
import { useAuth } from "./AuthContext";
import { getApiHelpers, type ApiRegistryEvent } from "./ApiWorkspaceSync";

type ClientWorkspaceContextValue = {
  registry: ClientRegistry;
  hasActiveClient: boolean;
  activeClientId: string;
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
  saveBrandGem: (gem: BrandGem) => string | null;
  switchClient: (clientId: string) => void;
  createClient: (name: string, slug?: string) => string;
  renameClient: (clientId: string, name: string) => void;
  deleteClient: (clientId: string) => boolean;
  resetActiveClient: () => void;
  persistWorkspaceNow: () => Promise<void>;
  useApiStorage: boolean;
};

const ClientWorkspaceContext = createContext<ClientWorkspaceContextValue | null>(null);

const SAVE_DEBOUNCE_MS = 300;

function touchMeta(meta: ClientMeta): ClientMeta {
  return { ...meta, updatedAt: new Date().toISOString() };
}

function initialWorkspace(reg: ClientRegistry): ClientWorkspace {
  if (reg.clients.length === 0) return createOrphanWorkspace();
  const meta =
    reg.clients.find((c) => c.id === reg.activeClientId) ?? reg.clients[0];
  if (!meta) return createOrphanWorkspace();
  return resolveWorkspaceForClient(reg.activeClientId, meta);
}

export function ClientWorkspaceProvider({ children }: { children: ReactNode }) {
  const { storageMode, user } = useAuth();
  const useApiStorage = storageMode === "postgresql" && !!user;

  const [registry, setRegistry] = useState<ClientRegistry>(() => ensureClientRegistry());
  const [workspace, setWorkspace] = useState<ClientWorkspace>(() =>
    initialWorkspace(ensureClientRegistry())
  );

  useEffect(() => {
    if (!useApiStorage) return;
    const onApiRegistry = (e: Event) => {
      const { registry: reg, workspace: ws } = (e as CustomEvent<ApiRegistryEvent>).detail;
      setRegistry(reg);
      setWorkspace(ws);
      workspaceRef.current = ws;
    };
    window.addEventListener("auragrid:api-registry", onApiRegistry);
    return () => window.removeEventListener("auragrid:api-registry", onApiRegistry);
  }, [useApiStorage]);

  const hasActiveClient = registry.clients.length > 0;
  const activeClientId = hasActiveClient ? registry.activeClientId : "";

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
    void saveWorkspaceResilient(clientId, ws).then(notifyStorageSaveFailure);
  }, []);

  const persistWorkspaceNow = useCallback(async () => {
    if (!activeClientId) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (useApiStorage) {
      const flush = getApiHelpers()?.flushWorkspaceNow;
      if (!flush) return;
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
            await api.patchWorkspace(registry.activeClientId, workspaceRef.current);
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
    setWorkspace((prev) => ({
      ...prev,
      posts: typeof action === "function" ? action(prev.posts) : action,
    }));
  }, []);

  const setStartDate: Dispatch<SetStateAction<string>> = useCallback((action) => {
    setWorkspace((prev) => ({
      ...prev,
      startDate: typeof action === "function" ? action(prev.startDate) : action,
    }));
  }, []);

  const setBrandGem: Dispatch<SetStateAction<BrandGem>> = useCallback((action) => {
    setWorkspace((prev) => {
      const nextGem = typeof action === "function" ? action(prev.brandGem) : action;
      return { ...prev, brandGem: { ...nextGem, id: prev.brandGem.id } };
    });
  }, []);

  const setCanvaPages: Dispatch<SetStateAction<CanvaGridPage[]>> = useCallback(
    (action) => {
      setWorkspace((prev) => {
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
    setWorkspace((prev) => ({
      ...prev,
      canva: {
        ...prev.canva,
        autoSync: typeof action === "function" ? action(prev.canva.autoSync) : action,
      },
    }));
  }, []);

  const setCanvaGridReversed: Dispatch<SetStateAction<boolean>> = useCallback(
    (action) => {
      setWorkspace((prev) => ({
        ...prev,
        canva: {
          ...prev.canva,
          reversed: typeof action === "function" ? action(prev.canva.reversed) : action,
        },
      }));
    },
    []
  );

  const setCanvaGridFormat = useCallback((format: CanvaGridFormatId) => {
    const defaults = getCanvaGridFormat(format);
    setWorkspace((prev) => ({
      ...prev,
      canva: {
        ...prev.canva,
        gridFormat: format,
        gridMaxWidth: defaults.defaultMaxWidth,
      },
    }));
  }, []);

  const setCanvaGridMaxWidth = useCallback((width: number) => {
    setWorkspace((prev) => {
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
    (gem: BrandGem): string | null => {
      if (!activeClientId) return null;
      const savedAt = new Date().toISOString();
      const normalized: BrandGem = { ...gem, id: activeClientId };
      setWorkspace((prev) => {
        const next: ClientWorkspace = {
          ...prev,
          brandGem: normalized,
          ui: { ...prev.ui, brandGemSavedAt: savedAt },
        };
        workspaceRef.current = next;
        if (!useApiStorage) {
          if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
          saveWorkspace(activeClientId, next);
        } else {
          void getApiHelpers()?.saveBrandGem(activeClientId, normalized);
        }
        return next;
      });
      return savedAt;
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
            await api.patchWorkspace(registry.activeClientId, workspaceRef.current);
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
    [registry, activeClientId, persistRegistry, setBrandGem]
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

  const resetActiveClient = useCallback(() => {
    if (!hasActiveClient) return;
    if (useApiStorage) {
      void (async () => {
        const api = getApiHelpers();
        if (!api) return;
        const dto = await api.resetClient(activeClientId);
        const ws = api.toWorkspace(dto);
        setWorkspace(ws);
        workspaceRef.current = ws;
      })();
      return;
    }
    const meta = activeClient;
    const ws = createEmptyWorkspace(meta);
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
      useApiStorage,
    }),
    [
      registry,
      hasActiveClient,
      activeClientId,
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
      useApiStorage,
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
