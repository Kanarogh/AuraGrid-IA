"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "./AuthContext";
import { useClientWorkspace } from "./ClientWorkspaceContext";
import { getAccessToken } from "../lib/api/apiClient";
import {
  activateClientApi,
  apiWorkspaceToClientWorkspace,
  createClientApi,
  deleteClientApi,
  fetchRegistry,
  fetchWorkspace,
  patchWorkspaceApi,
  resetClientApi,
  saveBrandGemApi,
} from "../lib/api/workspaceApi";
import type { ClientRegistry, ClientWorkspace } from "../lib/clientWorkspace";
import { createEmptyRegistry, createOrphanWorkspace } from "../lib/clientWorkspace";

const SAVE_DEBOUNCE_MS = 400;

function buildWorkspacePatch(ws: ClientWorkspace) {
  return {
    brandGem: ws.brandGem,
    startDate: ws.startDate,
    posts: ws.posts,
    canva: ws.canva,
    ui: ws.ui,
  };
}

function flushWorkspacePatch(clientId: string, ws: ClientWorkspace) {
  const token = getAccessToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  void fetch(`/api/v1/clients/${clientId}/workspace`, {
    method: "PATCH",
    headers,
    credentials: "include",
    body: JSON.stringify(buildWorkspacePatch(ws)),
    keepalive: true,
  }).catch(() => {
    // Falha esperada ao fechar/recarregar a aba — o browser aborta o request.
  });
}

/** Sincroniza workspace com PostgreSQL quando storageMode === postgresql */
export function ApiWorkspaceSync() {
  const { storageMode, user } = useAuth();
  const {
    registry,
    activeClientId,
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
  } = useClientWorkspace();

  const loadedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workspaceRef = useRef(workspace);
  const skipSaveRef = useRef(true);
  workspaceRef.current = workspace;

  // Bootstrap from API
  useEffect(() => {
    if (storageMode !== "postgresql" || !user) return;
    let cancelled = false;
    loadedRef.current = false;
    skipSaveRef.current = true;

    (async () => {
      try {
        const reg = await fetchRegistry();
        if (cancelled) return;
        const clientId = reg.activeClientId || reg.clients[0]?.id;
        if (!clientId) {
          window.dispatchEvent(
            new CustomEvent("auragrid:api-registry", {
              detail: { registry: reg, workspace: createOrphanWorkspace() },
            })
          );
          loadedRef.current = true;
          skipSaveRef.current = false;
          return;
        }
        const dto = await fetchWorkspace(clientId);
        if (cancelled) return;
        const ws = apiWorkspaceToClientWorkspace(dto);
        window.dispatchEvent(
          new CustomEvent("auragrid:api-registry", {
            detail: { registry: reg, workspace: ws },
          })
        );
        loadedRef.current = true;
        setTimeout(() => {
          skipSaveRef.current = false;
        }, 100);
      } catch (err) {
        console.error("[AuraGrid] Falha ao carregar workspace da API:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [storageMode, user?.id]);

  // Debounced PATCH
  useEffect(() => {
    if (storageMode !== "postgresql" || !user || !activeClientId || skipSaveRef.current) return;
    if (!loadedRef.current) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const ws = workspaceRef.current;
      void patchWorkspaceApi(activeClientId, buildWorkspacePatch(ws)).catch((err) =>
        console.error("[AuraGrid] Falha ao salvar workspace:", err)
      );
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [workspace, activeClientId, storageMode, user?.id]);

  // Flush imediato ao fechar/recarregar (evita perder PATCH debounced)
  useEffect(() => {
    if (storageMode !== "postgresql" || !user) return;

    const flushOnExit = () => {
      if (skipSaveRef.current || !activeClientId) return;
      // Só envia se ainda havia PATCH pendente no debounce (evita fetch ao sair sem mudanças).
      if (!saveTimerRef.current) return;
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      flushWorkspacePatch(activeClientId, workspaceRef.current);
    };

    window.addEventListener("beforeunload", flushOnExit);
    window.addEventListener("pagehide", flushOnExit);
    return () => {
      window.removeEventListener("beforeunload", flushOnExit);
      window.removeEventListener("pagehide", flushOnExit);
    };
  }, [storageMode, user?.id, activeClientId]);

  // Expose API actions on window for context hooks (avoid circular deps)
  useEffect(() => {
    if (storageMode !== "postgresql") return;

    const flushWorkspaceNow = async (ws: ClientWorkspace): Promise<void> => {
      if (skipSaveRef.current || !activeClientId || !loadedRef.current) return;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      await patchWorkspaceApi(activeClientId, buildWorkspacePatch(ws));
    };

    const api = {
      fetchRegistry,
      fetchWorkspace,
      createClient: createClientApi,
      activateClient: activateClientApi,
      deleteClient: deleteClientApi,
      resetClient: resetClientApi,
      saveBrandGem: saveBrandGemApi,
      patchWorkspace: patchWorkspaceApi,
      flushWorkspaceNow,
      toWorkspace: apiWorkspaceToClientWorkspace,
    };
    (window as unknown as { __auragridApi?: typeof api }).__auragridApi = api;
    return () => {
      delete (window as unknown as { __auragridApi?: typeof api }).__auragridApi;
    };
  }, [storageMode, activeClientId]);

  void setCatalog;
  void setPosts;
  void setStartDate;
  void setBrandGem;
  void setCanvaPages;
  void setActiveCanvaPageId;
  void setAutoSyncCanva;
  void setCanvaGridReversed;
  void setCanvaGridFormat;
  void setCanvaGridMaxWidth;
  void setUiPrefs;

  return null;
}

export function getApiHelpers() {
  return (window as unknown as {
    __auragridApi?: {
      fetchRegistry: typeof fetchRegistry;
      fetchWorkspace: typeof fetchWorkspace;
      createClient: typeof createClientApi;
      activateClient: typeof activateClientApi;
      deleteClient: typeof deleteClientApi;
      resetClient: typeof resetClientApi;
      saveBrandGem: typeof saveBrandGemApi;
      patchWorkspace: typeof patchWorkspaceApi;
      flushWorkspaceNow: (ws: ClientWorkspace) => Promise<void>;
      toWorkspace: typeof apiWorkspaceToClientWorkspace;
    };
  }).__auragridApi;
}

export type ApiRegistryEvent = {
  registry: ClientRegistry;
  workspace: ClientWorkspace;
};

export function emptyApiRegistry(): ClientRegistry {
  return createEmptyRegistry();
}
