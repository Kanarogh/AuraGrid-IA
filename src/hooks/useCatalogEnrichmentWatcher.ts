"use client";

import { useCallback } from "react";
import type { CatalogEnrichProgress } from "../lib/api/workspaceApi";

/**
 * Indexação via SSE (useRemoteSyncCoordinator). Este hook mantém a API
 * compatível com App.tsx sem poll de 2s.
 */
export function useCatalogEnrichmentWatcher({
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
  const startPolling = useCallback(() => {
    startEnrichLocal();
  }, [startEnrichLocal]);

  const stopLocalPolling = useCallback(() => {
    stopEnrichLocal();
  }, [stopEnrichLocal]);

  void onCatalogReload;

  return {
    isEnriching,
    progress: enrichProgress,
    startPolling,
    stopLocalPolling,
  };
}
