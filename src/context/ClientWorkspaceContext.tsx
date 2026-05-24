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
import { setCaptionCacheClientId } from "../lib/captionCache";
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
  deleteWorkspace,
  clearClientCaptionCache,
  uniqueClientId,
  slugifyClientName,
  type ClientMeta,
  type ClientRegistry,
  type ClientWorkspace,
} from "../lib/clientWorkspace";
import type { BrandGem, CanvaGridPage, CatalogItem, PlannedPost } from "../types";

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
  setUiPrefs: (partial: NonNullable<ClientWorkspace["ui"]>) => void;
  switchClient: (clientId: string) => void;
  createClient: (name: string, slug?: string) => string;
  renameClient: (clientId: string, name: string) => void;
  deleteClient: (clientId: string) => boolean;
  resetActiveClient: () => void;
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
  const [registry, setRegistry] = useState<ClientRegistry>(() => ensureClientRegistry());
  const [workspace, setWorkspace] = useState<ClientWorkspace>(() =>
    initialWorkspace(ensureClientRegistry())
  );

  const hasActiveClient = registry.clients.length > 0;
  const activeClientId = hasActiveClient ? registry.activeClientId : "";

  useEffect(() => {
    setCaptionCacheClientId(activeClientId);
  }, [activeClientId]);
  const activeClient = useMemo(() => {
    const found = registry.clients.find((c) => c.id === activeClientId);
    if (found) return found;
    if (registry.clients[0]) return registry.clients[0];
    return createClientMeta("", "Nenhum cliente");
  }, [registry, activeClientId]);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workspaceRef = useRef(workspace);
  workspaceRef.current = workspace;

  const flushSave = useCallback(
    (clientId: string, ws: ClientWorkspace) => {
      saveWorkspace(clientId, ws);
    },
    []
  );

  const scheduleSave = useCallback(
    (clientId: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        flushSave(clientId, workspaceRef.current);
      }, SAVE_DEBOUNCE_MS);
    },
    [flushSave]
  );

  useEffect(() => {
    if (!activeClientId) return;
    scheduleSave(activeClientId);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [workspace, activeClientId, scheduleSave]);

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
    [flushSave, loadClientIntoState]
  );

  const setCatalog: Dispatch<SetStateAction<CatalogItem[]>> = useCallback(
    (action) => {
      setWorkspace((prev) => {
        const nextCatalog =
          typeof action === "function"
            ? action(prev.catalog).map(normalizeCatalogItem)
            : action.map(normalizeCatalogItem);
        return { ...prev, catalog: nextCatalog };
      });
    },
    []
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
      setWorkspace((prev) => ({
        ...prev,
        canva: {
          ...prev.canva,
          pages: typeof action === "function" ? action(prev.canva.pages) : action,
        },
      }));
    },
    []
  );

  const setActiveCanvaPageId: Dispatch<SetStateAction<string>> = useCallback(
    (action) => {
      setWorkspace((prev) => ({
        ...prev,
        canva: {
          ...prev.canva,
          activePageId:
            typeof action === "function" ? action(prev.canva.activePageId) : action,
        },
      }));
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

  const setUiPrefs = useCallback((partial: NonNullable<ClientWorkspace["ui"]>) => {
    setWorkspace((prev) => ({
      ...prev,
      ui: { ...prev.ui, ...partial },
    }));
  }, []);

  const createClient = useCallback(
    (name: string, slug?: string): string => {
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
    [registry, flushSave, loadClientIntoState]
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
    [registry, activeClientId, persistRegistry, loadClientIntoState]
  );

  const resetActiveClient = useCallback(() => {
    if (!hasActiveClient) return;
    const meta = activeClient;
    const ws = createEmptyWorkspace(meta);
    setWorkspace(ws);
    workspaceRef.current = ws;
    flushSave(activeClientId, ws);
    clearClientCaptionCache(activeClientId);
  }, [activeClient, activeClientId, flushSave, hasActiveClient]);

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
      setUiPrefs,
      switchClient,
      createClient,
      renameClient,
      deleteClient,
      resetActiveClient,
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
      setUiPrefs,
      switchClient,
      createClient,
      renameClient,
      deleteClient,
      resetActiveClient,
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
