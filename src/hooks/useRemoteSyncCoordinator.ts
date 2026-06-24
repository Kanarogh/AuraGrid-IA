"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchSyncRevisionApi } from "../lib/api/workspaceApi";
import {
  openSyncEventSource,
  type SyncStreamEnrichEvent,
} from "../lib/api/syncStreamApi";
import { broadcastSyncChanged, subscribeSyncChanged } from "../lib/sync/broadcast";
import { isSyncPullPaused } from "../lib/sync/mutationGuard";
import {
  nextSseReconnectDelay,
  shouldUseFallbackPoll,
  SYNC_FALLBACK_POLL_MS,
  SYNC_REVISION_DEBOUNCE_MS,
} from "../lib/sync/realtimeCoordinator";
import { diffSyncRevisionTokens, type DiffSyncRevisionResult } from "../lib/sync/revisionDiff";
import {
  tokensFromSyncRevision,
  type SyncDomain,
  type SyncRevisionTokens,
} from "../lib/sync/types";
import { isWorkspaceSavePending } from "../lib/sync/workspaceSaveGuard";

export type PeriodsChangeContext = {
  prevToken: string;
  nextToken: string;
};

export type RemoteSyncHandlers = {
  onCatalogChange?: () => Promise<void>;
  onWorkspaceChange?: () => Promise<void>;
  onBrandGemChange?: () => Promise<void>;
  onPeriodsChange?: (ctx: PeriodsChangeContext) => Promise<void>;
  onRegistryChange?: () => Promise<void>;
  /** Preferencial: um único fetch por tick quando vários domínios mudam. */
  onDomainsChange?: (
    domains: SyncDomain[],
    ctx?: { periodTokenChange?: PeriodsChangeContext }
  ) => Promise<void>;
};

export type EnrichProgressState = {
  index: number;
  total: number;
  itemId: string;
  label: string;
};

function isDomainPaused(domain: SyncDomain): boolean {
  if (domain === "workspace" && isWorkspaceSavePending()) return true;
  return isSyncPullPaused(domain);
}

export function useRemoteSyncCoordinator({
  enabled,
  clientId,
  periodId,
  workspaceHydrated,
  handlers,
  onRemoteApplied,
}: {
  enabled: boolean;
  clientId: string;
  periodId: string;
  workspaceHydrated: boolean;
  handlers: RemoteSyncHandlers;
  onRemoteApplied?: (domains: SyncDomain[]) => void;
}) {
  const lastTokensRef = useRef<SyncRevisionTokens | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const onRemoteAppliedRef = useRef(onRemoteApplied);
  onRemoteAppliedRef.current = onRemoteApplied;

  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState<EnrichProgressState | null>(null);

  const applyDomainChanges = useCallback(async (result: DiffSyncRevisionResult) => {
    const { changed, periodTokenChange } = result;
    if (!changed.length) return;
    const h = handlersRef.current;

    if (h.onDomainsChange) {
      await h.onDomainsChange(changed, { periodTokenChange });
    } else {
      if (changed.includes("registry") && h.onRegistryChange) {
        await h.onRegistryChange();
      }
      if (changed.includes("periods") && h.onPeriodsChange && periodTokenChange) {
        await h.onPeriodsChange(periodTokenChange);
      }
      if (changed.includes("brandGem") && h.onBrandGemChange) {
        await h.onBrandGemChange();
      }
      if (changed.includes("workspace") && h.onWorkspaceChange) {
        await h.onWorkspaceChange();
      }
      if (changed.includes("catalog") && h.onCatalogChange) {
        await h.onCatalogChange();
      }
    }

    onRemoteAppliedRef.current?.(changed);
  }, []);

  const diffTokens = useCallback((next: SyncRevisionTokens): DiffSyncRevisionResult => {
    const prev = lastTokensRef.current;
    if (!prev) {
      lastTokensRef.current = next;
      return { changed: [] };
    }
    const result = diffSyncRevisionTokens(prev, next, isDomainPaused);
    lastTokensRef.current = next;
    return result;
  }, []);

  const syncNow = useCallback(async () => {
    if (!enabled || !clientId || !periodId) return null;
    try {
      const rev = await fetchSyncRevisionApi(clientId, periodId);
      const tokens = tokensFromSyncRevision(rev);
      const result = diffTokens(tokens);
      if (result.changed.length) await applyDomainChanges(result);
      return rev;
    } catch {
      return null;
    }
  }, [enabled, clientId, periodId, diffTokens, applyDomainChanges]);

  const setKnownTokens = useCallback((tokens: Partial<SyncRevisionTokens>) => {
    lastTokensRef.current = {
      catalog: tokens.catalog ?? lastTokensRef.current?.catalog ?? "",
      workspace: tokens.workspace ?? lastTokensRef.current?.workspace ?? "",
      brandGem: tokens.brandGem ?? lastTokensRef.current?.brandGem ?? "",
      periods: tokens.periods ?? lastTokensRef.current?.periods ?? "",
      registry: tokens.registry ?? lastTokensRef.current?.registry ?? "",
    };
  }, []);

  const publishSyncChange = useCallback(
    async (domains: SyncDomain[]) => {
      if (!enabled || !clientId || !periodId) return;
      try {
        const rev = await fetchSyncRevisionApi(clientId, periodId);
        const tokens = tokensFromSyncRevision(rev);
        setKnownTokens(tokens);
        broadcastSyncChanged(clientId, domains);
      } catch {
        broadcastSyncChanged(clientId, domains);
      }
    },
    [enabled, clientId, periodId, setKnownTokens]
  );

  const handleEnrichEvent = useCallback((data: SyncStreamEnrichEvent) => {
    setIsEnriching(data.enriching);
    setEnrichProgress(data.progress ?? null);
  }, []);

  const startEnrichLocal = useCallback(() => {
    setIsEnriching(true);
  }, []);

  const stopEnrichLocal = useCallback(() => {
    setIsEnriching(false);
    setEnrichProgress(null);
  }, []);

  useEffect(() => {
    if (!enabled || !clientId || !periodId || !workspaceHydrated) return;

    lastTokensRef.current = null;
    let cancelled = false;
    let sse: EventSource | null = null;
    let reconnectAttempt = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;
    let sseOpen = false;

    const scheduleSync = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        void syncNow();
      }, SYNC_REVISION_DEBOUNCE_MS);
    };

    const connectSse = () => {
      if (cancelled) return;
      sse?.close();
      sse = openSyncEventSource(clientId, periodId);

      sse.onopen = () => {
        sseOpen = true;
        reconnectAttempt = 0;
      };

      sse.addEventListener("revision", () => {
        scheduleSync();
      });

      sse.addEventListener("enrich", (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data) as SyncStreamEnrichEvent;
          handleEnrichEvent(data);
          if (data.enriching) {
            scheduleSync();
          }
        } catch {
          /* ignore */
        }
      });

      sse.onerror = () => {
        sseOpen = false;
        sse?.close();
        sse = null;
        if (cancelled) return;
        reconnectAttempt += 1;
        const delay = nextSseReconnectDelay(reconnectAttempt);
        reconnectTimer = setTimeout(connectSse, delay);
      };
    };

    connectSse();

    fallbackInterval = setInterval(() => {
      if (shouldUseFallbackPoll(sseOpen)) void syncNow();
    }, SYNC_FALLBACK_POLL_MS);

    void (async () => {
      try {
        const rev = await fetchSyncRevisionApi(clientId, periodId);
        if (cancelled) return;
        lastTokensRef.current = tokensFromSyncRevision(rev);
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (fallbackInterval) clearInterval(fallbackInterval);
      sse?.close();
    };
  }, [
    enabled,
    clientId,
    periodId,
    workspaceHydrated,
    syncNow,
    handleEnrichEvent,
  ]);

  useEffect(() => {
    if (!enabled || !clientId) return;

    return subscribeSyncChanged((changedClientId) => {
      if (changedClientId !== clientId) return;
      void syncNow();
    });
  }, [enabled, clientId, syncNow]);

  return {
    syncNow,
    setKnownTokens,
    publishSyncChange,
    isEnriching,
    enrichProgress,
    startEnrichLocal,
    stopEnrichLocal,
  };
}

/** @deprecated use useRemoteSyncCoordinator — nome legado mantido. */
export const useRealtimeSyncCoordinator = useRemoteSyncCoordinator;
