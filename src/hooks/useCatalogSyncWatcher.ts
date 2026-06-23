"use client";

import { useCallback, useEffect, useRef } from "react";
import { fetchCatalogRevisionApi } from "../lib/api/workspaceApi";
import { subscribeCatalogChanged } from "../lib/catalogBroadcast";
import { isCatalogMutationInFlight } from "../lib/catalogMutationGuard";

const POLL_INTERVAL_MS = 5000;

const activePollers = new Map<string, AbortController>();

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });
}

function isTabVisible(): boolean {
  return typeof document === "undefined" || document.visibilityState === "visible";
}

export function useCatalogSyncWatcher({
  enabled,
  clientId,
  workspaceHydrated,
  onCatalogReload,
}: {
  enabled: boolean;
  clientId: string;
  workspaceHydrated: boolean;
  onCatalogReload: () => Promise<void>;
}) {
  const lastRevisionRef = useRef<string | null>(null);
  const onReloadRef = useRef(onCatalogReload);
  onReloadRef.current = onCatalogReload;

  const applyRevision = useCallback(
    async (revision: string, forceReload = false) => {
      if (!forceReload && revision === lastRevisionRef.current) return;
      lastRevisionRef.current = revision;
      await onReloadRef.current();
    },
    []
  );

  const syncRevisionNow = useCallback(async () => {
    if (!enabled || !clientId) return null;
    try {
      const data = await fetchCatalogRevisionApi(clientId);
      await applyRevision(data.revision, true);
      return data.revision;
    } catch {
      return null;
    }
  }, [enabled, clientId, applyRevision]);

  const runPollLoop = useCallback(
    async (targetClientId: string, signal: AbortSignal) => {
      try {
        for (;;) {
          if (signal.aborted) break;
          if (isTabVisible() && !isCatalogMutationInFlight()) {
            try {
              const data = await fetchCatalogRevisionApi(targetClientId);
              if (signal.aborted) break;
              if (data.revision !== lastRevisionRef.current) {
                lastRevisionRef.current = data.revision;
                await onReloadRef.current();
              }
            } catch {
              /* rede — próximo tick */
            }
          }
          await sleep(POLL_INTERVAL_MS, signal);
        }
      } catch {
        /* abort */
      }
    },
    []
  );

  const ensurePolling = useCallback(() => {
    if (!enabled || !clientId) return;
    if (activePollers.has(clientId)) return;

    const controller = new AbortController();
    activePollers.set(clientId, controller);
    void runPollLoop(clientId, controller.signal).finally(() => {
      if (activePollers.get(clientId) === controller) {
        activePollers.delete(clientId);
      }
    });
  }, [enabled, clientId, runPollLoop]);

  const setKnownRevision = useCallback((revision: string) => {
    lastRevisionRef.current = revision;
  }, []);

  useEffect(() => {
    if (!enabled || !clientId || !workspaceHydrated) return;

    lastRevisionRef.current = null;
    ensurePolling();

    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchCatalogRevisionApi(clientId);
        if (cancelled) return;
        lastRevisionRef.current = data.revision;
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
      activePollers.get(clientId)?.abort();
      activePollers.delete(clientId);
    };
  }, [enabled, clientId, workspaceHydrated, ensurePolling]);

  useEffect(() => {
    if (!enabled || !clientId) return;

    return subscribeCatalogChanged((changedClientId, revision) => {
      if (changedClientId !== clientId) return;
      if (isCatalogMutationInFlight()) return;
      if (revision && revision === lastRevisionRef.current) return;
      void syncRevisionNow();
    });
  }, [enabled, clientId, syncRevisionNow]);

  return {
    syncRevisionNow,
    setKnownRevision,
  };
}
