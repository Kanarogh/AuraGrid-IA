"use client";

import { useCallback, useEffect, useRef } from "react";
import type { CatalogEnrichProgress } from "../lib/api/workspaceApi";

/**
 * Indexação via SSE (useRemoteSyncCoordinator).
 * Recarrega catálogo só ao terminar a fila (borda true→false).
 */
export function useCatalogEnrichmentWatcher({
  enabled,
  isEnriching,
  enrichProgress,
  startEnrichLocal,
  stopEnrichLocal,
  onCatalogReload,
}: {
  enabled: boolean;
  clientId: string;
  workspaceHydrated: boolean;
  onCatalogReload: () => Promise<void>;
  isEnriching: boolean;
  enrichProgress: CatalogEnrichProgress | null;
  startEnrichLocal: () => void;
  stopEnrichLocal: () => void;
}) {
  const onCatalogReloadRef = useRef(onCatalogReload);
  onCatalogReloadRef.current = onCatalogReload;
  const wasEnrichingRef = useRef(isEnriching);

  useEffect(() => {
    if (!enabled) return;
    const wasEnriching = wasEnrichingRef.current;
    wasEnrichingRef.current = isEnriching;
    if (wasEnriching && !isEnriching) {
      void onCatalogReloadRef.current();
    }
  }, [enabled, isEnriching]);

  const startPolling = useCallback(() => {
    startEnrichLocal();
  }, [startEnrichLocal]);

  const stopLocalPolling = useCallback(() => {
    stopEnrichLocal();
  }, [stopEnrichLocal]);

  return {
    isEnriching,
    progress: enrichProgress,
    startPolling,
    stopLocalPolling,
  };
}
