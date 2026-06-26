"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchSyncRevisionApi } from "../lib/api/workspaceApi";
import {
  openSyncEventSource,
  type SyncStreamEnrichEvent,
  type SyncStreamRevisionEvent,
} from "../lib/api/syncStreamApi";
import { broadcastSyncChanged, subscribeSyncChanged } from "../lib/sync/broadcast";
import { isLocalSyncEcho, markLocalSync } from "../lib/sync/localSyncAck";
import { isSyncPullPaused } from "../lib/sync/mutationGuard";
import {
  mergeSyncDomains,
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
import { syncDebugLog } from "../lib/sync/syncDebugLog";

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

import type { CatalogEnrichProgressDetail } from "../lib/enrichProgressStages";

export type EnrichProgressState = CatalogEnrichProgressDetail;

function isDomainPaused(domain: SyncDomain): boolean {
  if (domain === "workspace" && isWorkspaceSavePending()) return true;
  return isSyncPullPaused(domain);
}

function filterDomainsDuringEnrich(
  domains: SyncDomain[],
  isEnriching: boolean
): SyncDomain[] {
  if (!isEnriching) return domains;
  return domains.filter((d) => d !== "catalog");
}

/** NOTIFY lista domínios reais — ignora tokens colaterais (ex.: periods/registry após save do grid). */
function constrainChangedToSignal(
  changed: SyncDomain[],
  signalDomains?: SyncDomain[]
): SyncDomain[] {
  if (!signalDomains?.length) {
    return changed.filter((d) => d === "workspace" || d === "catalog");
  }
  return changed.filter((d) => signalDomains.includes(d));
}

function parseRevisionDomains(raw: string): SyncDomain[] {
  try {
    const data = JSON.parse(raw) as SyncStreamRevisionEvent;
    if (!Array.isArray(data.domains)) return [];
    return data.domains.filter((d): d is SyncDomain =>
      ["catalog", "workspace", "brandGem", "periods", "registry"].includes(d)
    );
  } catch {
    return [];
  }
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
  const isEnrichingRef = useRef(false);
  const syncInFlightRef = useRef(false);

  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState<EnrichProgressState | null>(null);
  isEnrichingRef.current = isEnriching;

  const refreshTokensOnly = useCallback(async () => {
    if (!enabled || !clientId || !periodId) return;
    try {
      const rev = await fetchSyncRevisionApi(clientId, periodId);
      lastTokensRef.current = tokensFromSyncRevision(rev);
    } catch {
      /* ignore */
    }
  }, [enabled, clientId, periodId]);

  const applyDomainChanges = useCallback(
    async (result: DiffSyncRevisionResult, signalDomains?: SyncDomain[]) => {
      const changed = filterDomainsDuringEnrich(
        constrainChangedToSignal(result.changed, signalDomains),
        isEnrichingRef.current
      );
      if (!changed.length) return;
      const h = handlersRef.current;

      if (h.onDomainsChange) {
        await h.onDomainsChange(changed, { periodTokenChange: result.periodTokenChange });
      } else {
        if (changed.includes("registry") && h.onRegistryChange) {
          await h.onRegistryChange();
        }
        if (changed.includes("periods") && h.onPeriodsChange && result.periodTokenChange) {
          await h.onPeriodsChange(result.periodTokenChange);
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
    },
    []
  );

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

  const syncNow = useCallback(
    async (signalDomains?: SyncDomain[]) => {
      if (!enabled || !clientId || !periodId) return null;
      if (syncInFlightRef.current) return null;
      syncInFlightRef.current = true;

      try {
      const mergedSignal = mergeSyncDomains(signalDomains ?? []);
      if (mergedSignal.length && isLocalSyncEcho(clientId, mergedSignal)) {
        syncDebugLog("sync.echo", { clientId, signal: mergedSignal });
        await refreshTokensOnly();
        return null;
      }

      syncDebugLog("sync.start", {
        clientId,
        periodId,
        signal: mergedSignal.length ? mergedSignal : "(fallback)",
      });

      const optimisticDomains = filterDomainsDuringEnrich(mergedSignal, isEnrichingRef.current).filter(
        (d) => !isDomainPaused(d)
      );
      const h = handlersRef.current;
      const revPromise = fetchSyncRevisionApi(clientId, periodId);
      const reloadPromise =
        optimisticDomains.length && h.onDomainsChange
          ? h.onDomainsChange(optimisticDomains)
          : null;

      try {
        const rev = await revPromise;
        const tokens = tokensFromSyncRevision(rev);
        const result = diffTokens(tokens);

        syncDebugLog("sync.diff", {
          changed: result.changed,
          signal: mergedSignal.length ? mergedSignal : undefined,
          periodSwitch: result.periodTokenChange ? true : undefined,
        });

        if (reloadPromise) {
          await reloadPromise;
          const structural = filterDomainsDuringEnrich(
            constrainChangedToSignal(result.changed, mergedSignal),
            isEnrichingRef.current
          ).filter((d) => d === "periods" || d === "registry");
          if (structural.length && h.onDomainsChange) {
            syncDebugLog("sync.apply", { domains: structural, via: "structural" });
            await h.onDomainsChange(structural, { periodTokenChange: result.periodTokenChange });
          }
          syncDebugLog("sync.done", { via: "optimistic" });
          return rev;
        }

        const toApply = constrainChangedToSignal(result.changed, mergedSignal);
        if (toApply.length) {
          syncDebugLog("sync.apply", { domains: toApply, via: "diff" });
          await applyDomainChanges({ ...result, changed: toApply }, mergedSignal);
        } else if (result.changed.length) {
          syncDebugLog("sync.skip", {
            reason: "filtered",
            raw: result.changed,
            signal: mergedSignal,
          });
        }
        syncDebugLog("sync.done", { via: "diff" });
        return rev;
      } catch (err) {
        syncDebugLog("sync.fail", {
          message: err instanceof Error ? err.message : String(err),
        });
        if (reloadPromise) await reloadPromise.catch(() => {});
        return null;
      }
      } finally {
        syncInFlightRef.current = false;
      }
    },
    [enabled, clientId, periodId, diffTokens, applyDomainChanges, refreshTokensOnly]
  );

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
      markLocalSync(clientId, domains);
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
    if (!data.enriching) {
      isEnrichingRef.current = false;
    }
  }, []);

  const startEnrichLocal = useCallback(() => {
    setIsEnriching(true);
    isEnrichingRef.current = true;
    markLocalSync(clientId, ["catalog"]);
  }, [clientId]);

  const stopEnrichLocal = useCallback(() => {
    setIsEnriching(false);
    setEnrichProgress(null);
    isEnrichingRef.current = false;
  }, []);

  useEffect(() => {
    if (!enabled || !clientId || !periodId || !workspaceHydrated) {
      syncDebugLog("sync.disabled", {
        enabled,
        clientId: clientId || "(vazio)",
        periodId: periodId || "(vazio)",
        workspaceHydrated,
      });
      return;
    }

    syncDebugLog("sync.start", { phase: "coordinator-init", clientId, periodId });

    lastTokensRef.current = null;
    let cancelled = false;
    let sse: EventSource | null = null;
    let reconnectAttempt = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;
    let sseOpen = false;
    let pendingDomains: SyncDomain[] = [];

    const scheduleSync = (signalDomains?: SyncDomain[]) => {
      if (signalDomains?.length) {
        pendingDomains = mergeSyncDomains([...pendingDomains, ...signalDomains]);
      }
      syncDebugLog("sync.schedule", {
        clientId,
        pending: pendingDomains,
        incoming: signalDomains,
      });
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const domains = pendingDomains;
        pendingDomains = [];
        void syncNow(domains.length ? domains : undefined);
      }, SYNC_REVISION_DEBOUNCE_MS);
    };

    let lastEnrichItemId: string | null = null;

    const connectSse = () => {
      if (cancelled) return;
      sse?.close();
      sse = openSyncEventSource(clientId, periodId);

      sse.onopen = () => {
        sseOpen = true;
        reconnectAttempt = 0;
        syncDebugLog("sse.open", { clientId, periodId });
      };

      sse.addEventListener("revision", (event) => {
        const domains = parseRevisionDomains((event as MessageEvent).data);
        syncDebugLog("sse.revision", { clientId, domains });
        scheduleSync(domains);
      });

      sse.addEventListener("enrich", (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data) as SyncStreamEnrichEvent;
          syncDebugLog("sse.enrich", {
            enriching: data.enriching,
            index: data.progress?.index,
            total: data.progress?.total,
          });
          handleEnrichEvent(data);
          const itemId = data.progress?.itemId;
          if (data.enriching && itemId && lastEnrichItemId && lastEnrichItemId !== itemId) {
            syncDebugLog("sse.enrich", {
              enriching: data.enriching,
              index: data.progress?.index,
              total: data.progress?.total,
              catalogRefresh: true,
              previous: lastEnrichItemId,
              next: itemId,
            });
            void handlersRef.current.onDomainsChange?.(["catalog"]);
          }
          if (data.enriching && itemId) {
            lastEnrichItemId = itemId;
          }
          if (!data.enriching) {
            lastEnrichItemId = null;
            scheduleSync(["catalog"]);
          }
        } catch {
          /* ignore */
        }
      });

      sse.onerror = () => {
        sseOpen = false;
        syncDebugLog("sse.error", { clientId, reconnectAttempt: reconnectAttempt + 1 });
        sse?.close();
        sse = null;
        if (cancelled) return;
        reconnectAttempt += 1;
        const delay = nextSseReconnectDelay(reconnectAttempt);
        syncDebugLog("sse.reconnect", { delayMs: delay });
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

    return subscribeSyncChanged((changedClientId, domains) => {
      if (changedClientId !== clientId) return;
      syncDebugLog("broadcast.in", { clientId, domains });
      void syncNow(domains);
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
