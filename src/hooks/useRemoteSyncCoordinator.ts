"use client";

import { useCallback, useEffect, useRef } from "react";
import { fetchSyncRevisionApi } from "../lib/api/workspaceApi";
import { broadcastSyncChanged, subscribeSyncChanged } from "../lib/sync/broadcast";
import { isSyncPullPaused } from "../lib/sync/mutationGuard";
import {
  tokensFromSyncRevision,
  type SyncDomain,
  type SyncRevisionTokens,
} from "../lib/sync/types";
import { isWorkspaceSavePending } from "../lib/sync/workspaceSaveGuard";

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

function pollKey(clientId: string, periodId: string): string {
  return `${clientId}:${periodId}`;
}

function isDomainPaused(domain: SyncDomain): boolean {
  if (domain === "workspace" && isWorkspaceSavePending()) return true;
  return isSyncPullPaused(domain);
}

export type RemoteSyncHandlers = {
  onCatalogChange?: () => Promise<void>;
  onWorkspaceChange?: () => Promise<void>;
  onBrandGemChange?: () => Promise<void>;
  onPeriodsChange?: () => Promise<void>;
  onRegistryChange?: () => Promise<void>;
};

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

  const applyDomainChanges = useCallback(async (changed: SyncDomain[]) => {
    if (!changed.length) return;
    const h = handlersRef.current;
    if (changed.includes("registry") && h.onRegistryChange) {
      await h.onRegistryChange();
    }
    if (changed.includes("periods") && h.onPeriodsChange) {
      await h.onPeriodsChange();
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
    onRemoteAppliedRef.current?.(changed);
  }, []);

  const diffTokens = useCallback(
    (next: SyncRevisionTokens): SyncDomain[] => {
      const prev = lastTokensRef.current;
      if (!prev) {
        lastTokensRef.current = next;
        return [];
      }
      const changed: SyncDomain[] = [];
      if (next.catalog !== prev.catalog && !isDomainPaused("catalog")) {
        changed.push("catalog");
      }
      if (next.workspace !== prev.workspace && !isDomainPaused("workspace")) {
        changed.push("workspace");
      }
      if (next.brandGem !== prev.brandGem && !isDomainPaused("brandGem")) {
        changed.push("brandGem");
      }
      if (next.periods !== prev.periods && !isDomainPaused("periods")) {
        changed.push("periods");
      }
      if (next.registry !== prev.registry && !isDomainPaused("registry")) {
        changed.push("registry");
      }
      lastTokensRef.current = next;
      return changed;
    },
    []
  );

  const syncNow = useCallback(async () => {
    if (!enabled || !clientId || !periodId) return null;
    try {
      const rev = await fetchSyncRevisionApi(clientId, periodId);
      const tokens = tokensFromSyncRevision(rev);
      const changed = diffTokens(tokens);
      if (changed.length) await applyDomainChanges(changed);
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

  const runPollLoop = useCallback(
    async (key: string, targetClientId: string, targetPeriodId: string, signal: AbortSignal) => {
      try {
        for (;;) {
          if (signal.aborted) break;
          if (isTabVisible()) {
            try {
              const rev = await fetchSyncRevisionApi(targetClientId, targetPeriodId);
              if (signal.aborted) break;
              const tokens = tokensFromSyncRevision(rev);
              const changed = diffTokens(tokens);
              if (changed.length) await applyDomainChanges(changed);
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
    [diffTokens, applyDomainChanges]
  );

  const ensurePolling = useCallback(
    (targetClientId: string, targetPeriodId: string) => {
      if (!enabled || !targetClientId || !targetPeriodId) return;
      const key = pollKey(targetClientId, targetPeriodId);
      if (activePollers.has(key)) return;

      const controller = new AbortController();
      activePollers.set(key, controller);
      void runPollLoop(key, targetClientId, targetPeriodId, controller.signal).finally(() => {
        if (activePollers.get(key) === controller) {
          activePollers.delete(key);
        }
      });
    },
    [enabled, runPollLoop]
  );

  useEffect(() => {
    if (!enabled || !clientId || !periodId || !workspaceHydrated) return;

    lastTokensRef.current = null;
    ensurePolling(clientId, periodId);

    let cancelled = false;
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
      const key = pollKey(clientId, periodId);
      activePollers.get(key)?.abort();
      activePollers.delete(key);
    };
  }, [enabled, clientId, periodId, workspaceHydrated, ensurePolling]);

  useEffect(() => {
    if (!enabled || !clientId) return;

    return subscribeSyncChanged((changedClientId, domains) => {
      if (changedClientId !== clientId) return;
      const blocked = domains.every((d) => isDomainPaused(d));
      if (blocked) return;
      void syncNow();
    });
  }, [enabled, clientId, syncNow]);

  return {
    syncNow,
    setKnownTokens,
    publishSyncChange,
  };
}
