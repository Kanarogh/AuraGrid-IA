"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchEnrichStatusApi,
  type CatalogEnrichProgress,
} from "../lib/api/workspaceApi";

const POLL_INTERVAL_MS = 2000;

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

export function useCatalogEnrichmentWatcher({
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
  const [isEnriching, setIsEnriching] = useState(false);
  const [progress, setProgress] = useState<CatalogEnrichProgress | null>(null);
  const onReloadRef = useRef(onCatalogReload);
  onReloadRef.current = onCatalogReload;

  const runPollLoop = useCallback(
    async (targetClientId: string, signal: AbortSignal) => {
      setIsEnriching(true);
      try {
        for (;;) {
          if (signal.aborted) break;
          const { enriching, progress: nextProgress } =
            await fetchEnrichStatusApi(targetClientId);
          if (signal.aborted) break;
          setProgress(nextProgress ?? null);
          setIsEnriching(enriching);
          await onReloadRef.current();
          if (!enriching) break;
          await sleep(POLL_INTERVAL_MS, signal);
        }
      } catch {
        /* rede — próximo tick ou remount retoma */
      } finally {
        if (!signal.aborted) {
          setIsEnriching(false);
          setProgress(null);
        }
      }
    },
    []
  );

  const ensurePolling = useCallback(
    (force = false) => {
      if (!enabled || !clientId) return;
      if (!force && activePollers.has(clientId)) return;

      activePollers.get(clientId)?.abort();
      const controller = new AbortController();
      activePollers.set(clientId, controller);
      void runPollLoop(clientId, controller.signal).finally(() => {
        if (activePollers.get(clientId) === controller) {
          activePollers.delete(clientId);
        }
      });
    },
    [enabled, clientId, runPollLoop]
  );

  const startPolling = useCallback(() => {
    ensurePolling(true);
  }, [ensurePolling]);

  const stopLocalPolling = useCallback(() => {
    if (!clientId) return;
    activePollers.get(clientId)?.abort();
    activePollers.delete(clientId);
    setIsEnriching(false);
    setProgress(null);
  }, [clientId]);

  useEffect(() => {
    if (!enabled || !clientId || !workspaceHydrated) return;

    let cancelled = false;
    void (async () => {
      try {
        const { enriching } = await fetchEnrichStatusApi(clientId);
        if (cancelled) return;
        if (enriching) ensurePolling();
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, clientId, workspaceHydrated, ensurePolling]);

  useEffect(() => {
    return () => {
      if (clientId) {
        activePollers.get(clientId)?.abort();
        activePollers.delete(clientId);
      }
    };
  }, [clientId]);

  return {
    isEnriching,
    progress,
    startPolling,
    stopLocalPolling,
  };
}
