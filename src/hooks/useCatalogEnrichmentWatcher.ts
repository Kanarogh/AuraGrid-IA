"use client";

import { useCallback, useEffect } from "react";
import type { CatalogEnrichProgress } from "../lib/api/workspaceApi";

/**
 * Indexação via SSE (useRemoteSyncCoordinator).
 * Recarrega catálogo ao terminar a fila (refresh por peça fica no coordinator).
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
  useEffect(() => {
    if (!enabled || isEnriching) return;
    void onCatalogReload();
  }, [enabled, isEnriching, onCatalogReload]);

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
