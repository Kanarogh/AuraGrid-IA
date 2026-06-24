import { getAccessToken } from "./apiClient";

export function buildSyncStreamUrl(clientId: string, periodId: string): string {
  const qs = new URLSearchParams();
  if (periodId) qs.set("periodId", periodId);
  const token = getAccessToken();
  if (token) qs.set("token", token);
  const query = qs.toString();
  return `/api/v1/clients/${clientId}/sync/stream${query ? `?${query}` : ""}`;
}

export function openSyncEventSource(clientId: string, periodId: string): EventSource {
  return new EventSource(buildSyncStreamUrl(clientId, periodId));
}

export type SyncStreamRevisionEvent = {
  domains: string[];
  periodId?: string;
};

export type SyncStreamEnrichEvent = {
  enriching: boolean;
  progress?: {
    index: number;
    total: number;
    itemId: string;
    label: string;
  };
};
