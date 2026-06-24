import { and, eq, isNull } from "drizzle-orm";
import { getDb, getSqlClient, isDatabaseConfigured } from "../db/client";
import { clients } from "../db/schema";
import {
  SYNC_NOTIFY_CHANNEL,
  type SyncDomain,
  type SyncEnrichProgress,
  type SyncEventPayload,
} from "./syncEvents";

const ownerCache = new Map<string, string>();

export async function resolveOwnerUserId(clientId: string): Promise<string | null> {
  const cached = ownerCache.get(clientId);
  if (cached) return cached;

  const db = getDb();
  const [row] = await db
    .select({ ownerUserId: clients.ownerUserId })
    .from(clients)
    .where(and(eq(clients.id, clientId), isNull(clients.deletedAt)))
    .limit(1);

  if (row?.ownerUserId) {
    ownerCache.set(clientId, row.ownerUserId);
    return row.ownerUserId;
  }
  return null;
}

export async function emitSyncEvent(payload: SyncEventPayload): Promise<void> {
  if (!isDatabaseConfigured()) return;

  try {
    const sql = getSqlClient();
    const json = JSON.stringify(payload);
    await sql`SELECT pg_notify(${SYNC_NOTIFY_CHANNEL}, ${json})`;
  } catch (err) {
    console.warn("[sync] pg_notify falhou:", err instanceof Error ? err.message : err);
  }
}

export async function emitClientSync(
  ownerUserId: string,
  clientId: string,
  domains: SyncDomain[],
  periodId?: string
): Promise<void> {
  if (!domains.length) return;
  await emitSyncEvent({
    v: 1,
    ownerUserId,
    clientId,
    domains,
    periodId,
  });
}

export async function emitRegistrySync(ownerUserId: string, clientId: string): Promise<void> {
  await emitClientSync(ownerUserId, clientId, ["registry"]);
}

export async function emitEnrichProgress(
  ownerUserId: string,
  clientId: string,
  periodId: string | undefined,
  enriching: boolean,
  progress?: SyncEnrichProgress
): Promise<void> {
  await emitSyncEvent({
    v: 1,
    ownerUserId,
    clientId,
    domains: ["catalog"],
    periodId,
    enrich: { enriching, progress },
  });
}
