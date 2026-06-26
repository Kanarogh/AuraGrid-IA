"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, readApiJson } from "../lib/api/apiClient";

export type AiUsageModelRow = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostMicros: number;
  calls: number;
  tokenLimit: number | null;
  tokenRemaining: number | null;
  costLimitMicros: number | null;
  costRemainingMicros: number | null;
};

export type DashboardAiUsageResponse = {
  window: "rolling_30d";
  usage: {
    byModel: AiUsageModelRow[];
    totals: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      estimatedCostMicros: number;
      calls: number;
    };
    internalLimit: {
      tokenLimit: number | null;
      tokenRemaining: number | null;
      costLimitMicros: number | null;
      costRemainingMicros: number | null;
      source: "default" | "override";
    };
  };
  googleQuota: {
    status: "ok" | "unavailable" | "error";
    message: string;
    metric?: string;
    limit?: number | null;
    used?: number | null;
    remaining?: number | null;
  };
};

export function useDashboardAiUsage(clientId: string | null) {
  const [data, setData] = useState<DashboardAiUsageResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clientId) {
      setData(null);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/v1/clients/${encodeURIComponent(clientId)}/ai/usage?window=rolling_30d`);
      if (res.status === 401) {
        setData(null);
        setError(null);
        return;
      }
      const payload = await readApiJson<DashboardAiUsageResponse>(res);
      setData(payload);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, isLoading, error, reload: load };
}
