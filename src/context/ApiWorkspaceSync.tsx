"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  buildWorkspaceApiPatch,
  buildWorkspaceContentPatch,
  workspaceContentFingerprint,
  workspaceApiPatchFingerprint,
} from "../lib/clientWorkspace/apiWorkspacePatch";
import { emitCloudSaveStatus } from "../lib/cloudSaveStatus";
import { broadcastSyncChanged } from "../lib/sync/broadcast";
import { markLocalSync } from "../lib/sync/localSyncAck";
import {
  isApplyingRemoteWorkspace,
  isWorkspacePatchAlreadySynced,
  markWorkspacePatchSynced,
} from "../lib/sync/remoteApplyGuard";
import { setWorkspaceSavePending } from "../lib/sync/workspaceSaveGuard";
import { syncDebugLog } from "../lib/sync/syncDebugLog";
import { toast } from "../lib/toast";

const SAVE_DEBOUNCE_MS = 200;
const LOAD_RETRIES = 3;
const LOAD_RETRY_DELAY_MS = 800;

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function fetchWorkspaceWithRetry(clientId: string) {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= LOAD_RETRIES; attempt++) {
    try {
      return await fetchWorkspace(clientId);
    } catch (err) {
      lastErr = err;
      if (attempt < LOAD_RETRIES) await sleep(LOAD_RETRY_DELAY_MS);
    }
  }
  throw lastErr;
}

function buildWorkspacePatch(ws: ClientWorkspace) {
  return buildWorkspaceContentPatch(ws);
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
    isClientSwitching,
  } = useClientWorkspace();

  const loadedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workspaceRef = useRef(workspace);
  const skipSaveRef = useRef(true);
  const [reloadNonce, setReloadNonce] = useState(0);
  workspaceRef.current = workspace;

  const contentFingerprint = useMemo(
    () => workspaceContentFingerprint(workspace) ?? "",
    [workspace]
  );

  useEffect(() => {
    const onReload = () => setReloadNonce((n) => n + 1);
    window.addEventListener("aurastudio:api-reload-request", onReload);
    return () => window.removeEventListener("aurastudio:api-reload-request", onReload);
  }, []);

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
            new CustomEvent("aurastudio:api-registry", {
              detail: { registry: reg, workspace: createOrphanWorkspace() },
            })
          );
          loadedRef.current = true;
          skipSaveRef.current = false;
          return;
        }
        const dto = await fetchWorkspaceWithRetry(clientId);
        if (cancelled) return;
        const ws = apiWorkspaceToClientWorkspace(dto);
        const fp = workspaceApiPatchFingerprint(ws);
        if (fp) markWorkspacePatchSynced(clientId, fp);
        window.dispatchEvent(
          new CustomEvent("aurastudio:api-registry", {
            detail: { registry: reg, workspace: ws },
          })
        );
        loadedRef.current = true;
        setTimeout(() => {
          skipSaveRef.current = false;
        }, 100);
      } catch (err) {
        console.error("[AuraStudio] Falha ao carregar workspace da API:", err);
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Falha ao carregar workspace da nuvem.";
          window.dispatchEvent(
            new CustomEvent("aurastudio:api-load-failed", { detail: { message } })
          );
          loadedRef.current = false;
          skipSaveRef.current = true;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [storageMode, user?.id, reloadNonce]);

  // Debounced PATCH — só quando conteúdo muda (posts, gem, canva…), não ao trocar de dia na UI
  useEffect(() => {
    if (storageMode !== "postgresql" || !user || !activeClientId || skipSaveRef.current) return;
    if (!loadedRef.current) return;
    if (isClientSwitching) return;
    if (isApplyingRemoteWorkspace()) return;
    if (!contentFingerprint) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setWorkspaceSavePending(true);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      const ws = workspaceRef.current;
      const patch = buildWorkspacePatch(ws);
      if (!patch) {
        setWorkspaceSavePending(false);
        return;
      }
      const fingerprint = contentFingerprint;
      if (isWorkspacePatchAlreadySynced(activeClientId, fingerprint)) {
        syncDebugLog("save.skip", { clientId: activeClientId, reason: "fingerprint-match" });
        setWorkspaceSavePending(false);
        return;
      }
      syncDebugLog("save.patch", {
        clientId: activeClientId,
        debounceMs: SAVE_DEBOUNCE_MS,
        reason: "content-changed",
      });
      markLocalSync(activeClientId, ["workspace"]);
      if (!isApplyingRemoteWorkspace()) emitCloudSaveStatus("saving");
      void patchWorkspaceApi(activeClientId, patch)
        .then(() => {
          markWorkspacePatchSynced(activeClientId, fingerprint);
          if (!isApplyingRemoteWorkspace()) emitCloudSaveStatus("saved");
          broadcastSyncChanged(activeClientId, ["workspace"]);
        })
        .catch((err) => {
          console.error("[AuraStudio] Falha ao salvar workspace:", err);
          if (!isApplyingRemoteWorkspace()) {
            emitCloudSaveStatus("error");
            const message =
              err instanceof Error ? err.message : "Não foi possível salvar na nuvem.";
            toast.error(message);
          }
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
  }, [contentFingerprint, activeClientId, storageMode, user?.id, isClientSwitching]);

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
        console.warn("[AuraStudio] Flush do workspace ignorado (bootstrap em andamento).");
        emitCloudSaveStatus("error");
        return;
      }

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      setWorkspaceSavePending(true);
      markLocalSync(activeClientId, ["workspace"]);
      if (!isApplyingRemoteWorkspace()) emitCloudSaveStatus("saving");
      try {
        const patch = buildWorkspaceContentPatch(ws);
        if (!patch) return;
        const fingerprint = workspaceContentFingerprint(ws);
        if (!fingerprint || isWorkspacePatchAlreadySynced(activeClientId, fingerprint)) return;
        await patchWorkspaceApi(activeClientId, patch);
        markWorkspacePatchSynced(activeClientId, fingerprint);
        if (!isApplyingRemoteWorkspace()) emitCloudSaveStatus("saved");
        broadcastSyncChanged(activeClientId, ["workspace"]);
      } catch (err) {
        if (!isApplyingRemoteWorkspace()) emitCloudSaveStatus("error");
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
    (window as unknown as { __aurastudioApi?: typeof api }).__aurastudioApi = api;
    return () => {
      delete (window as unknown as { __aurastudioApi?: typeof api }).__aurastudioApi;
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
    __aurastudioApi?: {
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
  }).__aurastudioApi;
}

export type ApiRegistryEvent = {
  registry: ClientRegistry;
  workspace: ClientWorkspace;
};

export function emptyApiRegistry(): ClientRegistry {
  return createEmptyRegistry();
}
