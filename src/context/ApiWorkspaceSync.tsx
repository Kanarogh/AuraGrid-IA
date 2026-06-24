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
import {
  compactCanvaForApiPatch,
  stripTransientPostFields,
} from "../lib/clientWorkspace/persistence";
import { createEmptyRegistry, createOrphanWorkspace } from "../lib/clientWorkspace";
import { emitCloudSaveStatus } from "../lib/cloudSaveStatus";
import { broadcastSyncChanged } from "../lib/sync/broadcast";
import { markLocalSync } from "../lib/sync/localSyncAck";
import { setWorkspaceSavePending } from "../lib/sync/workspaceSaveGuard";

const SAVE_DEBOUNCE_MS = 200;

function buildWorkspacePatch(ws: ClientWorkspace) {
  if (ws.isReadOnly) return null;
  return {
    brandGem: ws.brandGem,
    startDate: ws.startDate,
    planningPeriodId: ws.activePlanningPeriodId,
    posts: ws.posts.map(stripTransientPostFields),
    canva: compactCanvaForApiPatch(ws.canva),
    ui: ws.ui,
  };
}

function flushWorkspacePatch(clientId: string, ws: ClientWorkspace) {
  const patch = buildWorkspacePatch(ws);
  if (!patch) return;
  markLocalSync(clientId, ["workspace"]);
  broadcastSyncChanged(clientId, ["workspace"]);
  const token = getAccessToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  void fetch(`/api/v1/clients/${clientId}/workspace`, {
    method: "PATCH",
    headers,
    credentials: "include",
    body: JSON.stringify(patch),
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
        if (!cancelled) {
          window.dispatchEvent(
            new CustomEvent("auragrid:api-registry", {
              detail: { registry: createEmptyRegistry(), workspace: createOrphanWorkspace() },
            })
          );
          loadedRef.current = true;
          skipSaveRef.current = false;
        }
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
    setWorkspaceSavePending(true);
    markLocalSync(activeClientId, ["workspace"]);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      const ws = workspaceRef.current;
      const patch = buildWorkspacePatch(ws);
      if (!patch) {
        setWorkspaceSavePending(false);
        return;
      }
      emitCloudSaveStatus("saving");
      void patchWorkspaceApi(activeClientId, patch)
        .then(() => {
          emitCloudSaveStatus("saved");
          broadcastSyncChanged(activeClientId, ["workspace"]);
        })
        .catch((err) => {
          console.error("[AuraGrid] Falha ao salvar workspace:", err);
          emitCloudSaveStatus("error");
        })
        .finally(() => setWorkspaceSavePending(false));
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        setWorkspaceSavePending(false);
      }
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

    const flushWorkspaceNow = async (
      ws: ClientWorkspace,
      allowRetry = true
    ): Promise<void> => {
      if (!activeClientId) return;

      if (skipSaveRef.current || !loadedRef.current) {
        if (allowRetry) {
          await new Promise((r) => setTimeout(r, 150));
          return flushWorkspaceNow(ws, false);
        }
        console.warn("[AuraGrid] Flush do workspace ignorado (bootstrap em andamento).");
        emitCloudSaveStatus("error");
        return;
      }

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      setWorkspaceSavePending(true);
      markLocalSync(activeClientId, ["workspace"]);
      emitCloudSaveStatus("saving");
      try {
        const patch = buildWorkspacePatch(ws);
        if (!patch) return;
        await patchWorkspaceApi(activeClientId, patch);
        emitCloudSaveStatus("saved");
        broadcastSyncChanged(activeClientId, ["workspace"]);
      } catch (err) {
        emitCloudSaveStatus("error");
        throw err;
      } finally {
        setWorkspaceSavePending(false);
      }
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
