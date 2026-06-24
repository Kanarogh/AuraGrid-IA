import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import {
  brandGems,
  canvaPages,
  canvaSettings,
  canvaSlots,
  clients,
  plannedPosts,
  planningPeriods,
} from "../db/schema";
import {
  getCatalogRevision,
  type CatalogRevision,
} from "./catalogService";
import { listClientsForUser } from "./clientService";
import {
  ensureClientHasActivePeriod,
  listPeriodsForClient,
} from "./planningPeriodService";

export type SyncRevision = {
  periodId: string;
  catalog: CatalogRevision;
  workspace: string;
  brandGem: string;
  periods: string;
  registry: string;
  clientUpdatedAt: string;
};

export function buildWorkspaceRevisionToken(params: {
  periodId: string;
  periodUpdatedAt: string | null;
  clientUpdatedAt: string;
  startDate: string;
  postCount: number;
  slotCount: number;
  pageCount: number;
  canvaSettingsKey: string;
}): string {
  return `${params.periodId}:${params.periodUpdatedAt ?? "0"}:${params.startDate}:${params.postCount}:${params.slotCount}:${params.pageCount}:${params.canvaSettingsKey}:${params.clientUpdatedAt}`;
}

export function buildBrandGemRevisionToken(
  savedAt: string | null,
  campaignContext: string
): string {
  const ctxKey = campaignContext
    ? `${campaignContext.length}:${campaignContext.slice(0, 48)}`
    : "0";
  return `${savedAt ?? "0"}:${ctxKey}`;
}

export function buildPeriodsRevisionToken(
  activePeriodId: string | null,
  maxUpdatedAt: string | null,
  count: number
): string {
  return `${activePeriodId ?? "0"}:${maxUpdatedAt ?? "0"}:${count}`;
}

export function buildRegistryRevisionToken(
  maxUpdatedAt: string | null,
  count: number
): string {
  return `${maxUpdatedAt ?? "0"}:${count}`;
}

export async function getSyncRevision(
  userId: string,
  clientId: string,
  planningPeriodId?: string | null
): Promise<SyncRevision> {
  const db = getDb();
  const periodId = planningPeriodId ?? (await ensureClientHasActivePeriod(clientId));

  const catalog = await getCatalogRevision(clientId, periodId);

  const [clientRow] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, clientId), isNull(clients.deletedAt)))
    .limit(1);

  const clientUpdatedAt = clientRow?.updatedAt.toISOString() ?? "0";

  const [periodRow] = await db
    .select()
    .from(planningPeriods)
    .where(eq(planningPeriods.id, periodId))
    .limit(1);

  const [postStats] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(plannedPosts)
    .where(eq(plannedPosts.planningPeriodId, periodId));

  const [slotStats] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(canvaSlots)
    .where(eq(canvaSlots.planningPeriodId, periodId));

  const [pageStats] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(canvaPages)
    .where(eq(canvaPages.planningPeriodId, periodId));

  const [canvaCfg] = await db
    .select()
    .from(canvaSettings)
    .where(eq(canvaSettings.planningPeriodId, periodId))
    .limit(1);

  const canvaSettingsKey = canvaCfg
    ? `${canvaCfg.activePageId}|${canvaCfg.autoSync}|${canvaCfg.reversed}|${canvaCfg.gridFormat}|${canvaCfg.gridMaxWidth}`
    : "0";

  const workspace = buildWorkspaceRevisionToken({
    periodId,
    periodUpdatedAt: periodRow?.updatedAt?.toISOString() ?? null,
    clientUpdatedAt,
    startDate: String(periodRow?.startDate ?? clientRow?.startDate ?? ""),
    postCount: postStats?.count ?? 0,
    slotCount: slotStats?.count ?? 0,
    pageCount: pageStats?.count ?? 0,
    canvaSettingsKey,
  });

  const [gemRow] = await db
    .select()
    .from(brandGems)
    .where(eq(brandGems.clientId, clientId))
    .limit(1);

  const brandGem = buildBrandGemRevisionToken(
    gemRow?.savedAt?.toISOString() ?? null,
    periodRow?.campaignContext ?? ""
  );

  const periodsList = await listPeriodsForClient(clientId);
  const maxPeriodUpdated = periodsList.reduce<string | null>((max, p) => {
    if (!max || p.updatedAt > max) return p.updatedAt;
    return max;
  }, null);
  const activePeriodId = clientRow?.activePlanningPeriodId ?? periodId;
  const periods = buildPeriodsRevisionToken(
    activePeriodId,
    maxPeriodUpdated,
    periodsList.length
  );

  const clientList = await listClientsForUser(userId);
  const maxClientUpdated = clientList[0]?.updatedAt.toISOString() ?? null;
  const registry = buildRegistryRevisionToken(maxClientUpdated, clientList.length);

  return {
    periodId,
    catalog,
    workspace,
    brandGem,
    periods,
    registry,
    clientUpdatedAt,
  };
}
