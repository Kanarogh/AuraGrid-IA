import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import {
  canvaPages,
  canvaSettings,
  canvaSlots,
  catalogItems,
  clients,
  plannedPosts,
  planningPeriods,
} from "../db/schema";
import {
  defaultPlanningStartDate,
  defaultCanvaPages,
  defaultPeriodId,
  defaultPosts,
  periodLabelFromDate,
} from "./planningDefaults";
import { emitClientSync, emitEnrichProgress, resolveOwnerUserId } from "../sync/emitSyncEvent";
import type { SyncDomain } from "../sync/syncEvents";
import { resolveUsesReferences } from "../lib/referenceWorkflow";
import { recalculatePostDates, toDateOnlyString } from "@/src/lib/dates";
import type { PlannedPost } from "@/src/types";

async function notifyPeriodChange(
  clientId: string,
  domains: SyncDomain[],
  periodId?: string
): Promise<void> {
  const ownerId = await resolveOwnerUserId(clientId);
  if (ownerId) void emitClientSync(ownerId, clientId, domains, periodId);
}

export type PlanningPeriodStatus = "active" | "archived" | "draft";

export type PlanningPeriodDto = {
  id: string;
  label: string;
  startDate: string;
  status: PlanningPeriodStatus;
  campaignContext: string;
  usesReferences?: boolean | null;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  filledPostsCount?: number;
};

function toPeriodDto(
  row: typeof planningPeriods.$inferSelect,
  filledPostsCount?: number
): PlanningPeriodDto {
  return {
    id: row.id,
    label: row.label,
    startDate: toDateOnlyString(row.startDate),
    status: row.status as PlanningPeriodStatus,
    campaignContext: row.campaignContext,
    usesReferences: row.usesReferences ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    archivedAt: row.archivedAt?.toISOString(),
    filledPostsCount,
  };
}

export async function getActivePeriodId(clientId: string): Promise<string | null> {
  const db = getDb();
  const [client] = await db
    .select({ activePlanningPeriodId: clients.activePlanningPeriodId })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  return client?.activePlanningPeriodId ?? null;
}

export async function getPeriodForClient(clientId: string, periodId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(planningPeriods)
    .where(and(eq(planningPeriods.clientId, clientId), eq(planningPeriods.id, periodId)))
    .limit(1);
  return row ?? null;
}

export async function getEffectiveUsesReferences(
  clientId: string,
  periodId?: string | null
): Promise<boolean> {
  const db = getDb();
  const [client] = await db
    .select({
      defaultUsesReferences: clients.defaultUsesReferences,
      activePlanningPeriodId: clients.activePlanningPeriodId,
    })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  if (!client) return true;
  const pid = periodId ?? client.activePlanningPeriodId;
  if (!pid) return client.defaultUsesReferences ?? true;
  const period = await getPeriodForClient(clientId, pid);
  return resolveUsesReferences(client.defaultUsesReferences, period?.usesReferences ?? null);
}

export async function listPeriodsForClient(clientId: string): Promise<PlanningPeriodDto[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(planningPeriods)
    .where(eq(planningPeriods.clientId, clientId))
    .orderBy(desc(planningPeriods.startDate), desc(planningPeriods.createdAt));

  const filledCounts = await db
    .select({
      planningPeriodId: plannedPosts.planningPeriodId,
      count: sql<number>`count(*)::int`,
    })
    .from(plannedPosts)
    .where(eq(plannedPosts.clientId, clientId))
    .groupBy(plannedPosts.planningPeriodId);

  const countByPeriod = new Map(filledCounts.map((r) => [r.planningPeriodId, r.count]));

  return rows.map((row) => toPeriodDto(row, countByPeriod.get(row.id) ?? 0));
}

function uniquePeriodId(clientId: string): string {
  return `${clientId}__period_${Date.now()}`;
}

async function syncPeriodPostDateLabels(
  clientId: string,
  periodId: string,
  startDate: string
) {
  const normalized = toDateOnlyString(startDate);
  if (!normalized) return;

  const db = getDb();
  const rows = await db
    .select()
    .from(plannedPosts)
    .where(
      and(eq(plannedPosts.clientId, clientId), eq(plannedPosts.planningPeriodId, periodId))
    )
    .orderBy(asc(plannedPosts.dayNumber));

  if (!rows.length) return;

  const asPosts: PlannedPost[] = rows.map((row) => ({
    id: row.id,
    dayNumber: row.dayNumber,
    dateLabel: row.dateLabel,
    image: null,
    matchedCatalogId: row.matchedCatalogId,
    reasoning: row.reasoning,
    caption: row.caption,
    isGenerating: false,
    isGenerated: row.isGenerated,
    isConfirmed: row.isConfirmed,
    error: row.lastError,
  }));

  const recalculated = recalculatePostDates(normalized, asPosts);
  for (const post of recalculated) {
    await db
      .update(plannedPosts)
      .set({ dateLabel: post.dateLabel })
      .where(eq(plannedPosts.id, post.id));
  }
}

async function seedEmptyPeriod(clientId: string, periodId: string, startDate: string) {
  const db = getDb();
  const { pages, slots, activePageId } = defaultCanvaPages(clientId, periodId);
  await db.insert(canvaSettings).values({
    clientId,
    planningPeriodId: periodId,
    activePageId,
    autoSync: true,
    reversed: true,
    gridFormat: "square",
    gridMaxWidth: 480,
  });
  await db.insert(canvaPages).values(pages);
  await db.insert(canvaSlots).values(slots);
  await db.insert(plannedPosts).values(defaultPosts(clientId, periodId));
  await syncPeriodPostDateLabels(clientId, periodId, startDate);
}

async function archiveActivePeriod(clientId: string) {
  const db = getDb();
  const now = new Date();
  await db
    .update(planningPeriods)
    .set({ status: "archived", archivedAt: now, updatedAt: now })
    .where(and(eq(planningPeriods.clientId, clientId), eq(planningPeriods.status, "active")));
}

async function duplicatePeriodData(
  clientId: string,
  sourcePeriodId: string,
  targetPeriodId: string
) {
  const db = getDb();

  const [sourcePeriodRow] = await db
    .select({ contentSchedule: planningPeriods.contentSchedule })
    .from(planningPeriods)
    .where(eq(planningPeriods.id, sourcePeriodId))
    .limit(1);

  const sourceCatalog = await db
    .select()
    .from(catalogItems)
    .where(
      and(eq(catalogItems.clientId, clientId), eq(catalogItems.planningPeriodId, sourcePeriodId))
    );
  const catalogIdMap = new Map<string, string>();
  for (const item of sourceCatalog) {
    const newId = `${item.id}_copy_${targetPeriodId.slice(-8)}`;
    catalogIdMap.set(item.id, newId);
    await db.insert(catalogItems).values({
      id: newId,
      clientId,
      planningPeriodId: targetPeriodId,
      label: item.label,
      description: item.description,
      isReference: item.isReference,
      imageAssetId: item.imageAssetId,
      visualProfile: item.visualProfile,
      enrichmentStatus: item.enrichmentStatus,
      enrichedAt: item.enrichedAt,
      enrichmentError: item.enrichmentError,
      sortOrder: item.sortOrder,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    });
  }

  const [sourceCfg] = await db
    .select()
    .from(canvaSettings)
    .where(eq(canvaSettings.planningPeriodId, sourcePeriodId))
    .limit(1);

  const sourcePages = await db
    .select()
    .from(canvaPages)
    .where(eq(canvaPages.planningPeriodId, sourcePeriodId))
    .orderBy(asc(canvaPages.sortOrder));
  const sourceSlots = await db
    .select()
    .from(canvaSlots)
    .where(eq(canvaSlots.planningPeriodId, sourcePeriodId))
    .orderBy(asc(canvaSlots.slotIndex));

  await db.insert(canvaSettings).values({
    clientId,
    planningPeriodId: targetPeriodId,
    activePageId: sourceCfg?.activePageId ?? "page_4",
    autoSync: sourceCfg?.autoSync ?? true,
    reversed: sourceCfg?.reversed ?? true,
    gridFormat: sourceCfg?.gridFormat ?? "square",
    gridMaxWidth: sourceCfg?.gridMaxWidth ?? 480,
  });

  for (const page of sourcePages) {
    await db.insert(canvaPages).values({
      id: page.id,
      clientId,
      planningPeriodId: targetPeriodId,
      name: page.name,
      sortOrder: page.sortOrder,
    });
  }

  for (const slot of sourceSlots) {
    await db.insert(canvaSlots).values({
      id: slot.id,
      clientId,
      planningPeriodId: targetPeriodId,
      pageId: slot.pageId,
      slotIndex: slot.slotIndex,
      label: slot.label,
      matchedCatalogId: slot.matchedCatalogId
        ? (catalogIdMap.get(slot.matchedCatalogId) ?? null)
        : null,
      imageAssetId: slot.imageAssetId,
    });
  }

  const sourcePosts = await db
    .select()
    .from(plannedPosts)
    .where(eq(plannedPosts.planningPeriodId, sourcePeriodId))
    .orderBy(asc(plannedPosts.dayNumber));

  for (const post of sourcePosts) {
    await db.insert(plannedPosts).values({
      id: post.id,
      clientId,
      planningPeriodId: targetPeriodId,
      dayNumber: post.dayNumber,
      dateLabel: post.dateLabel,
      imageAssetId: post.imageAssetId,
      canvaSlotId: post.canvaSlotId,
      matchedCatalogId: post.matchedCatalogId
        ? (catalogIdMap.get(post.matchedCatalogId) ?? null)
        : null,
      reasoning: post.reasoning,
      caption: post.caption,
      isGenerated: post.isGenerated,
      isConfirmed: post.isConfirmed,
      captionFromImageOnly: post.captionFromImageOnly,
      structuredCopy: post.structuredCopy,
      captionFromSchedule: post.captionFromSchedule,
      captionModel: post.captionModel,
      lastError: post.lastError,
    });
  }

  await db
    .update(planningPeriods)
    .set({
      contentSchedule: sourcePeriodRow?.contentSchedule ?? [],
      updatedAt: new Date(),
    })
    .where(eq(planningPeriods.id, targetPeriodId));
}

export async function createInitialPeriodForClient(
  clientId: string,
  startDate = defaultPlanningStartDate(),
  campaignContext = ""
) {
  const db = getDb();
  const periodId = defaultPeriodId(clientId);
  const now = new Date();
  const label = periodLabelFromDate(startDate);

  await db.insert(planningPeriods).values({
    id: periodId,
    clientId,
    label,
    startDate,
    status: "active",
    campaignContext,
    createdAt: now,
    updatedAt: now,
  });

  await seedEmptyPeriod(clientId, periodId, startDate);

  await db
    .update(clients)
    .set({ activePlanningPeriodId: periodId, startDate, updatedAt: now })
    .where(eq(clients.id, clientId));

  return periodId;
}

export async function createPeriod(
  clientId: string,
  options: {
    label?: string;
    startDate?: string;
    sourcePeriodId?: string;
    activate?: boolean;
    usesReferences?: boolean | null;
  } = {}
) {
  const db = getDb();
  const startDate = toDateOnlyString(options.startDate) || defaultPlanningStartDate();
  const label = options.label?.trim() || periodLabelFromDate(startDate);
  const periodId = uniquePeriodId(clientId);
  const now = new Date();

  let campaignContext = "";
  let usesReferences: boolean | null = null;
  if (options.sourcePeriodId) {
    const source = await getPeriodForClient(clientId, options.sourcePeriodId);
    if (!source) throw new Error("Roteiro de origem não encontrado.");
    campaignContext = source.campaignContext;
    usesReferences = source.usesReferences ?? null;
  }

  if (options.activate !== false) {
    await archiveActivePeriod(clientId);
  }

  await db.insert(planningPeriods).values({
    id: periodId,
    clientId,
    label,
    startDate,
    status: options.activate === false ? "draft" : "active",
    campaignContext,
    usesReferences: options.usesReferences ?? usesReferences,
    createdAt: now,
    updatedAt: now,
  });

  if (options.sourcePeriodId) {
    await duplicatePeriodData(clientId, options.sourcePeriodId, periodId);
    await syncPeriodPostDateLabels(clientId, periodId, startDate);
  } else {
    await seedEmptyPeriod(clientId, periodId, startDate);
  }

  if (options.activate !== false) {
    await db
      .update(clients)
      .set({ activePlanningPeriodId: periodId, startDate, updatedAt: now })
      .where(eq(clients.id, clientId));
  }

  const [row] = await db
    .select()
    .from(planningPeriods)
    .where(eq(planningPeriods.id, periodId))
    .limit(1);
  if (!row) throw new Error("Falha ao criar roteiro.");
  const domains: SyncDomain[] = ["periods"];
  if (options.activate !== false) domains.push("workspace");
  void notifyPeriodChange(clientId, domains, periodId);
  return toPeriodDto(row);
}

export async function activatePeriod(clientId: string, periodId: string) {
  const db = getDb();
  const period = await getPeriodForClient(clientId, periodId);
  if (!period) throw new Error("Roteiro não encontrado.");

  const now = new Date();
  await archiveActivePeriod(clientId);

  await db
    .update(planningPeriods)
    .set({ status: "active", archivedAt: null, updatedAt: now })
    .where(eq(planningPeriods.id, periodId));

  await db
    .update(clients)
    .set({
      activePlanningPeriodId: periodId,
      startDate: period.startDate,
      updatedAt: now,
    })
    .where(eq(clients.id, clientId));

  void notifyPeriodChange(clientId, ["periods", "workspace"], periodId);
  return toPeriodDto({ ...period, status: "active", archivedAt: null, updatedAt: now });
}

export async function archivePeriod(clientId: string, periodId: string) {
  const db = getDb();
  const period = await getPeriodForClient(clientId, periodId);
  if (!period) throw new Error("Roteiro não encontrado.");
  if (period.status === "archived") return toPeriodDto(period);

  const now = new Date();
  await db
    .update(planningPeriods)
    .set({ status: "archived", archivedAt: now, updatedAt: now })
    .where(eq(planningPeriods.id, periodId));

  const activeId = await getActivePeriodId(clientId);
  if (activeId === periodId) {
    await db
      .update(clients)
      .set({ activePlanningPeriodId: null, updatedAt: now })
      .where(eq(clients.id, clientId));
  }

  return toPeriodDto({ ...period, status: "archived", archivedAt: now, updatedAt: now });
}

export async function updatePeriod(
  clientId: string,
  periodId: string,
  patch: {
    label?: string;
    startDate?: string;
    campaignContext?: string;
    usesReferences?: boolean | null;
  },
  options?: { allowArchived?: boolean }
) {
  const db = getDb();
  const period = await getPeriodForClient(clientId, periodId);
  if (!period) throw new Error("Roteiro não encontrado.");
  if (period.status === "archived" && !options?.allowArchived) {
    throw new Error("Roteiros arquivados são somente leitura.");
  }

  const now = new Date();
  const updates: Partial<typeof planningPeriods.$inferInsert> = {};
  if (
    typeof patch.label === "string" &&
    patch.label.trim() &&
    period.status !== "archived"
  ) {
    const nextLabel = patch.label.trim();
    if (nextLabel !== period.label) updates.label = nextLabel;
  }
  if (typeof patch.startDate === "string" && patch.startDate !== period.startDate) {
    updates.startDate = patch.startDate;
  }
  if (typeof patch.campaignContext === "string" && patch.campaignContext !== period.campaignContext) {
    updates.campaignContext = patch.campaignContext;
  }
  if (patch.usesReferences === true || patch.usesReferences === false) {
    if (patch.usesReferences !== period.usesReferences) {
      updates.usesReferences = patch.usesReferences;
    }
  } else if (patch.usesReferences === null && period.usesReferences !== null) {
    updates.usesReferences = null;
  }

  if (!Object.keys(updates).length) {
    return toPeriodDto(period);
  }

  updates.updatedAt = now;
  await db.update(planningPeriods).set(updates).where(eq(planningPeriods.id, periodId));

  const activeId = await getActivePeriodId(clientId);
  if (activeId === periodId && updates.startDate) {
    await db
      .update(clients)
      .set({ startDate: updates.startDate, updatedAt: now })
      .where(eq(clients.id, clientId));
  }

  const [updated] = await db
    .select()
    .from(planningPeriods)
    .where(eq(planningPeriods.id, periodId))
    .limit(1);
  void notifyPeriodChange(clientId, ["periods"], periodId);
  return toPeriodDto(updated!);
}

export async function resetPeriod(clientId: string, periodId: string) {
  const db = getDb();
  const period = await getPeriodForClient(clientId, periodId);
  if (!period) throw new Error("Roteiro não encontrado.");
  if (period.status === "archived") {
    throw new Error("Roteiros arquivados não podem ser resetados.");
  }

  await db
    .delete(catalogItems)
    .where(
      and(eq(catalogItems.clientId, clientId), eq(catalogItems.planningPeriodId, periodId))
    );
  await db.delete(plannedPosts).where(eq(plannedPosts.planningPeriodId, periodId));
  await db.delete(canvaSlots).where(eq(canvaSlots.planningPeriodId, periodId));
  await db.delete(canvaPages).where(eq(canvaPages.planningPeriodId, periodId));
  await db.delete(canvaSettings).where(eq(canvaSettings.planningPeriodId, periodId));

  await seedEmptyPeriod(clientId, periodId, toDateOnlyString(period.startDate));

  const now = new Date();
  await db
    .update(planningPeriods)
    .set({ campaignContext: "", contentSchedule: [], updatedAt: now })
    .where(eq(planningPeriods.id, periodId));
}

export async function isPeriodReadOnly(clientId: string, periodId: string): Promise<boolean> {
  const period = await getPeriodForClient(clientId, periodId);
  return period?.status === "archived";
}

export async function ensureClientHasActivePeriod(clientId: string, startDate?: string) {
  const activeId = await getActivePeriodId(clientId);
  if (activeId) return activeId;
  return createInitialPeriodForClient(clientId, startDate ?? defaultPlanningStartDate());
}

export async function loadPeriodsSummary(clientId: string) {
  return listPeriodsForClient(clientId);
}

export async function deletePeriodsForClient(clientId: string) {
  const db = getDb();
  const periods = await db
    .select({ id: planningPeriods.id })
    .from(planningPeriods)
    .where(eq(planningPeriods.clientId, clientId));
  const ids = periods.map((p) => p.id);
  if (ids.length === 0) return;
  await db.delete(planningPeriods).where(inArray(planningPeriods.id, ids));
}
