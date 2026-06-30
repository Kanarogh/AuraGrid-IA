export const SYNC_NOTIFY_CHANNEL = "aurastudio_sync";

export type SyncDomain =
  | "catalog"
  | "workspace"
  | "brandGem"
  | "periods"
  | "registry";

export type SyncEnrichProgress = {
  index: number;
  total: number;
  itemId: string;
  label: string;
  phase?: string;
  itemPercent?: number;
  stepLabel?: string;
};

export type SyncEventPayload = {
  v: 1;
  ownerUserId: string;
  clientId: string;
  domains: SyncDomain[];
  periodId?: string;
  enrich?: {
    enriching: boolean;
    progress?: SyncEnrichProgress;
  };
};

export function parseSyncEventPayload(raw: string): SyncEventPayload | null {
  try {
    const data = JSON.parse(raw) as SyncEventPayload;
    if (data?.v !== 1 || !data.ownerUserId || !data.clientId || !Array.isArray(data.domains)) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}
