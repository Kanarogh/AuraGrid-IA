import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "../db/client";
import {
  brandGems,
  canvaPages,
  canvaSettings,
  canvaSlots,
  catalogItems,
  clientUiPrefs,
  clients,
  plannedPosts,
  planningPeriods,
  userClientState,
} from "../db/schema";
import { listAccessibleClientIds, resolveClientAccess } from "./permissionService";
import { canAccessSection } from "@/src/lib/permissions/roleTemplates";
import { mediaPublicUrl } from "./mediaService";
import { parseBrandGemSaveBody } from "../validation/brandGemSchema";
import {
  defaultPlanningStartDate,
  defaultCanvaPages,
  defaultPosts,
} from "./planningDefaults";
import {
  createInitialPeriodForClient,
  ensureClientHasActivePeriod,
  getActivePeriodId,
  getPeriodForClient,
  isPeriodReadOnly,
  listPeriodsForClient,
  resetPeriod,
  updatePeriod,
} from "./planningPeriodService";
import { resolveUsesReferences } from "../lib/referenceWorkflow";
import { emitClientSync, emitRegistrySync } from "../sync/emitSyncEvent";
import { serverSyncDebugLog } from "../sync/syncDebugLog";

function slugify(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "cliente";
}

export async function uniqueClientId(ownerUserId: string, baseSlug: string): Promise<string> {
  const db = getDb();
  let id = baseSlug;
  let n = 2;
  while (true) {
    const [row] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.id, id), eq(clients.ownerUserId, ownerUserId)))
      .limit(1);
    if (!row) return id;
    id = `${baseSlug}-${n}`;
    n += 1;
  }
}

export async function listClientsForUser(userId: string) {
  const db = getDb();
  const ids = await listAccessibleClientIds(userId);
  if (ids.length === 0) return [];
  return db
    .select()
    .from(clients)
    .where(and(inArray(clients.id, ids), isNull(clients.deletedAt)))
    .orderBy(desc(clients.updatedAt));
}

export async function getActiveClientId(userId: string): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(userClientState)
    .where(eq(userClientState.userId, userId))
    .limit(1);
  return row?.activeClientId ?? null;
}

export async function createClientForUser(userId: string, name: string, slug?: string) {
  const db = getDb();
  const base = slug?.trim() || slugify(name);
  const id = await uniqueClientId(userId, base);
  const now = new Date();
  const displayName = name.trim() || id;

  await db.insert(clients).values({
    id,
    ownerUserId: userId,
    name: displayName,
    instagramHandle: id.replace(/-/g, "_"),
    startDate: defaultPlanningStartDate(),
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(brandGems).values({
    clientId: id,
    name: displayName,
    description: "",
    instructions: "",
    campaignContext: "",
    captionParams: {},
    footer: { structure: "", address: "", contact: "", hashtags: "", extra: "", customFields: [] },
  });

  await createInitialPeriodForClient(id, defaultPlanningStartDate());

  await db
    .insert(userClientState)
    .values({ userId, activeClientId: id })
    .onConflictDoUpdate({
      target: userClientState.userId,
      set: { activeClientId: id },
    });

  void emitRegistrySync(userId, id);
  return { id, name: displayName };
}

export async function setActiveClient(userId: string, clientId: string) {
  const ids = await listAccessibleClientIds(userId);
  if (!ids.includes(clientId)) {
    throw new Error("Cliente não encontrado.");
  }
  const db = getDb();
  await db
    .insert(userClientState)
    .values({ userId, activeClientId: clientId })
    .onConflictDoUpdate({
      target: userClientState.userId,
      set: { activeClientId: clientId },
    });
}

export async function renameClient(userId: string, clientId: string, name: string) {
  const db = getDb();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Nome inválido.");
  await db
    .update(clients)
    .set({ name: trimmed, updatedAt: new Date() })
    .where(and(eq(clients.id, clientId), eq(clients.ownerUserId, userId)));
  await db.update(brandGems).set({ name: trimmed }).where(eq(brandGems.clientId, clientId));
  void emitRegistrySync(userId, clientId);
}

export async function softDeleteClient(userId: string, clientId: string) {
  const db = getDb();
  await db
    .update(clients)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(clients.id, clientId), eq(clients.ownerUserId, userId)));

  const active = await getActiveClientId(userId);
  if (active === clientId) {
    const remaining = await listClientsForUser(userId);
    const next = remaining[0]?.id ?? null;
    if (next) await setActiveClient(userId, next);
    else await db.delete(userClientState).where(eq(userClientState.userId, userId));
  }
  void emitRegistrySync(userId, clientId);
}

export async function loadWorkspaceDto(
  userId: string,
  clientId: string,
  periodId?: string
) {
  const db = getDb();

  const accessible = await listAccessibleClientIds(userId);
  if (!accessible.includes(clientId)) {
    throw new Error("Cliente não encontrado.");
  }

  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, clientId), isNull(clients.deletedAt)))
    .limit(1);
  if (!client) throw new Error("Cliente não encontrado.");

  const activePeriodId =
    periodId ?? client.activePlanningPeriodId ?? (await ensureClientHasActivePeriod(clientId));

  const planningPeriodsList = await listPeriodsForClient(clientId);
  const activePeriod =
    planningPeriodsList.find((p) => p.id === activePeriodId) ??
    planningPeriodsList.find((p) => p.status === "active") ??
    planningPeriodsList[0];

  const periodStartDate = activePeriod?.startDate ?? client.startDate;
  const periodCampaignContext = activePeriod?.campaignContext ?? "";
  const isReadOnly = activePeriod?.status === "archived";
  const defaultUsesReferences = client.defaultUsesReferences ?? true;
  const usesReferences = resolveUsesReferences(
    defaultUsesReferences,
    activePeriod?.usesReferences ?? null
  );

  const [gem] = await db.select().from(brandGems).where(eq(brandGems.clientId, clientId)).limit(1);
  const [canvaCfg] = await db
    .select()
    .from(canvaSettings)
    .where(eq(canvaSettings.planningPeriodId, activePeriodId))
    .limit(1);
  const pages = await db
    .select()
    .from(canvaPages)
    .where(eq(canvaPages.planningPeriodId, activePeriodId))
    .orderBy(asc(canvaPages.sortOrder));
  const slots = await db
    .select()
    .from(canvaSlots)
    .where(eq(canvaSlots.planningPeriodId, activePeriodId))
    .orderBy(asc(canvaSlots.slotIndex));
  const catalog = await db
    .select()
    .from(catalogItems)
    .where(
      and(eq(catalogItems.clientId, clientId), eq(catalogItems.planningPeriodId, activePeriodId))
    )
    .orderBy(desc(catalogItems.createdAt));
  const posts = await db
    .select()
    .from(plannedPosts)
    .where(eq(plannedPosts.planningPeriodId, activePeriodId))
    .orderBy(asc(plannedPosts.dayNumber));
  const [ui] = await db
    .select()
    .from(clientUiPrefs)
    .where(and(eq(clientUiPrefs.userId, userId), eq(clientUiPrefs.clientId, clientId)))
    .limit(1);

  const [periodRow] = await db
    .select()
    .from(planningPeriods)
    .where(eq(planningPeriods.id, activePeriodId))
    .limit(1);

  const contentScheduleDto = Array.isArray(periodRow?.contentSchedule)
    ? periodRow.contentSchedule
    : [];
  const contentScheduleBrief =
    typeof periodRow?.contentScheduleBrief === "string" ? periodRow.contentScheduleBrief : "";

  const catalogDto = catalog.map((c) => ({
    id: c.id,
    label: c.label,
    description: c.description ?? undefined,
    isReference: c.isReference,
    imageAssetId: c.imageAssetId,
    imageUrl: c.imageAssetId ? mediaPublicUrl(c.imageAssetId) : undefined,
    image: null as string | null,
    visualProfile: c.visualProfile ?? undefined,
    enrichmentStatus: c.enrichmentStatus as
      | "pending"
      | "processing"
      | "ready"
      | "ready_limited"
      | "failed"
      | undefined,
    enrichedAt: c.enrichedAt?.toISOString(),
    enrichmentError: c.enrichmentError ?? undefined,
  }));

  const catalogAssetById = new Map(
    catalog
      .filter((c) => c.imageAssetId)
      .map((c) => [c.id, c.imageAssetId as string])
  );

  const pagesWithSlots = (
    pages.length > 0 ? pages : defaultCanvaPages(clientId, activePeriodId).pages
  ).map((p) => ({
    id: p.id,
    name: p.name,
    slots: Array.from({ length: 12 }, (_, i) => {
      const row = slots.find((s) => s.pageId === p.id && s.slotIndex === i);
      if (row) {
        const resolvedAssetId =
          row.imageAssetId ??
          (row.matchedCatalogId ? (catalogAssetById.get(row.matchedCatalogId) ?? null) : null);
        return {
          id: row.id,
          image: resolvedAssetId ? mediaPublicUrl(resolvedAssetId) : null,
          imageAssetId: resolvedAssetId,
          label: row.label,
          matchedCatalogId: row.matchedCatalogId,
        };
      }
      return {
        id: `slot_${p.id}_${i}`,
        image: null,
        imageAssetId: null,
        label: `Look ${i + 1}`,
        matchedCatalogId: null,
      };
    }),
  }));

  const postsDto = (posts.length > 0 ? posts : defaultPosts(clientId, activePeriodId)).map(
    (p) => ({
      id: p.id,
      dayNumber: p.dayNumber,
      dateLabel: p.dateLabel,
      image: p.imageAssetId ? mediaPublicUrl(p.imageAssetId) : null,
      imageAssetId: p.imageAssetId,
      matchedCatalogId: p.matchedCatalogId,
      reasoning: p.reasoning,
      caption: p.caption,
      isGenerating: false,
      isGenerated: p.isGenerated,
      isConfirmed: p.isConfirmed,
      error: p.lastError,
      canvaSlotRef: p.canvaSlotId
        ? { pageId: findPageForSlot(slots, p.canvaSlotId), slotId: p.canvaSlotId }
        : null,
      captionFromImageOnly: p.captionFromImageOnly,
      structuredCopy: "structuredCopy" in p ? ((p.structuredCopy as object | null) ?? undefined) : undefined,
      captionFromSchedule:
        "captionFromSchedule" in p ? Boolean(p.captionFromSchedule) : false,
      captionModel: "captionModel" in p ? (p.captionModel as string | null) : null,
    })
  );

  const dto = {
    version: 1 as const,
    client: {
      id: client.id,
      name: client.name,
      instagramHandle: client.instagramHandle ?? client.id.replace(/-/g, "_"),
      defaultUsesReferences,
      createdAt: client.createdAt.toISOString(),
      updatedAt: client.updatedAt.toISOString(),
    },
    brandGem: {
      id: clientId,
      name: gem?.name ?? client.name,
      description: gem?.description ?? "",
      instructions: gem?.instructions ?? "",
      campaignContext: periodCampaignContext,
      captionParams: gem?.captionParams ?? {},
      footer: gem?.footer ?? {},
    },
    catalog: catalogDto,
    posts: postsDto,
    contentSchedule: contentScheduleDto,
    contentScheduleBrief,
    startDate: periodStartDate,
    activePlanningPeriodId: activePeriodId,
    planningPeriods: planningPeriodsList,
    isReadOnly,
    defaultUsesReferences,
    usesReferences,
    canva: {
      pages: pagesWithSlots,
      activePageId: canvaCfg?.activePageId ?? "page_1",
      autoSync: canvaCfg?.autoSync ?? true,
      reversed: canvaCfg?.reversed ?? true,
      gridFormat: canvaCfg?.gridFormat ?? "square",
      gridMaxWidth: canvaCfg?.gridMaxWidth ?? 480,
    },
    ui: {
      activeSection: ui?.activeSection ?? "posts",
      activePreviewId: ui?.activePreviewId ?? "post_day1",
      viewMode: ui?.viewMode ?? "split",
      brandGemSavedAt: gem?.savedAt?.toISOString(),
    },
  };

  return filterWorkspaceByPermissions(dto, userId, clientId);
}

async function filterWorkspaceByPermissions<T extends {
  posts: unknown[];
  catalog: unknown[];
  canva: { pages: unknown[]; activePageId: string; autoSync: boolean; reversed: boolean; gridFormat: string; gridMaxWidth: number };
  contentSchedule: unknown;
  contentScheduleBrief: unknown;
  brandGem: Record<string, unknown>;
  planningPeriods: unknown[];
}>(
  workspace: T,
  userId: string,
  clientId: string
): Promise<T> {
  const access = await resolveClientAccess(userId, clientId);
  if (!access || access.level === "owner") return workspace;

  const perms = access.permissions;
  const filtered = { ...workspace };

  if (!canAccessSection(perms, "posts", "read")) {
    filtered.posts = [];
  }
  if (!canAccessSection(perms, "catalog", "read")) {
    filtered.catalog = [];
  }
  if (!canAccessSection(perms, "canva_grid", "read")) {
    filtered.canva = {
      ...workspace.canva,
      pages: [],
    };
  }
  if (!canAccessSection(perms, "content_schedule", "read")) {
    filtered.contentSchedule = [];
    filtered.contentScheduleBrief = null;
    filtered.planningPeriods = [];
  }
  if (!canAccessSection(perms, "settings", "read")) {
    filtered.brandGem = {
      id: workspace.brandGem.id ?? clientId,
      name: workspace.brandGem.name ?? "",
      description: "",
      instructions: "",
      campaignContext: "",
      captionParams: {},
      footer: {},
    };
  }

  return filtered;
}

function findPageForSlot(slots: { id: string; pageId: string }[], slotId: string): string {
  return slots.find((s) => s.id === slotId)?.pageId ?? "page_1";
}

function sanitizeCatalogRefId(raw: unknown, validCatalogIds: Set<string>): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "string" || !raw.trim()) return null;
  if (raw.startsWith("canva_")) return null;
  return validCatalogIds.has(raw) ? raw : null;
}

type BrandGemPatchInput = {
  name: string;
  description: string;
  instructions: string;
  campaignContext?: string;
  captionParams?: unknown;
  footer?: unknown;
};

function brandGemFingerprint(gem: BrandGemPatchInput): string {
  return JSON.stringify({
    name: (gem.name ?? "").trim(),
    description: gem.description ?? "",
    instructions: gem.instructions ?? "",
    captionParams: gem.captionParams ?? {},
    footer: gem.footer ?? {},
  });
}

/** Persiste gem enviada no PATCH do workspace sem bump/notify se nada mudou. */
async function syncBrandGemFromWorkspacePatch(
  userId: string,
  clientId: string,
  periodId: string,
  gem: BrandGemPatchInput
): Promise<boolean> {
  const validated = parseBrandGemSaveBody(gem);
  const db = getDb();

  const trimmedName = validated.name.trim() || clientId;
  const nextFp = brandGemFingerprint(validated);

  const [existing] = await db
    .select()
    .from(brandGems)
    .where(eq(brandGems.clientId, clientId))
    .limit(1);

  const prevFp = existing
    ? brandGemFingerprint({
        name: existing.name,
        description: existing.description,
        instructions: existing.instructions,
        captionParams: existing.captionParams,
        footer: existing.footer,
      })
    : "";

  const campaignContext =
    typeof validated.campaignContext === "string" ? validated.campaignContext : undefined;

  let periodContextChanged = false;
  if (campaignContext !== undefined) {
    const [periodRow] = await db
      .select({ campaignContext: planningPeriods.campaignContext })
      .from(planningPeriods)
      .where(eq(planningPeriods.id, periodId))
      .limit(1);
    periodContextChanged = (periodRow?.campaignContext ?? "") !== campaignContext;
  }

  const gemChanged = !existing || nextFp !== prevFp;
  if (!gemChanged && !periodContextChanged) {
    return false;
  }

  if (gemChanged) {
    const savedAt = new Date();
    await db
      .insert(brandGems)
      .values({
        clientId,
        name: trimmedName,
        description: validated.description,
        instructions: validated.instructions,
        campaignContext: "",
        captionParams: validated.captionParams ?? {},
        footer: validated.footer ?? {},
        savedAt,
      })
      .onConflictDoUpdate({
        target: brandGems.clientId,
        set: {
          name: trimmedName,
          description: validated.description,
          instructions: validated.instructions,
          captionParams: validated.captionParams ?? {},
          footer: validated.footer ?? {},
          savedAt,
        },
      });

    if (!existing || existing.name !== trimmedName) {
      await db
        .update(clients)
        .set({ name: trimmedName, updatedAt: new Date() })
        .where(and(eq(clients.id, clientId), eq(clients.ownerUserId, userId)));
    }
  }

  if (periodContextChanged && campaignContext !== undefined) {
    const period = await getPeriodForClient(clientId, periodId);
    await updatePeriod(
      clientId,
      periodId,
      { campaignContext },
      { allowArchived: period?.status === "archived" }
    );
  }

  return gemChanged || periodContextChanged;
}

export async function saveBrandGem(
  userId: string,
  clientId: string,
  gem: {
    name: string;
    description: string;
    instructions: string;
    campaignContext?: string;
    captionParams?: unknown;
    footer?: unknown;
  }
) {
  const db = getDb();
  const savedAt = new Date();
  const trimmedName = gem.name.trim() || clientId;
  const activePeriodId = await ensureClientHasActivePeriod(clientId);

  if (await isPeriodReadOnly(clientId, activePeriodId)) {
    throw new Error("Roteiro arquivado é somente leitura.");
  }

  await db
    .insert(brandGems)
    .values({
      clientId,
      name: trimmedName,
      description: gem.description,
      instructions: gem.instructions,
      campaignContext: "",
      captionParams: gem.captionParams ?? {},
      footer: gem.footer ?? {},
      savedAt,
    })
    .onConflictDoUpdate({
      target: brandGems.clientId,
      set: {
        name: trimmedName,
        description: gem.description,
        instructions: gem.instructions,
        captionParams: gem.captionParams ?? {},
        footer: gem.footer ?? {},
        savedAt,
      },
    });

  if (typeof gem.campaignContext === "string") {
    await updatePeriod(clientId, activePeriodId, { campaignContext: gem.campaignContext });
  }

  await db
    .update(clients)
    .set({ name: trimmedName, updatedAt: new Date() })
    .where(and(eq(clients.id, clientId), eq(clients.ownerUserId, userId)));

  void emitClientSync(userId, clientId, ["brandGem"], activePeriodId);
  return savedAt.toISOString();
}

export async function patchWorkspace(
  userId: string,
  clientId: string,
  patch: Record<string, unknown>
) {
  const db = getDb();
  const periodId =
    typeof patch.planningPeriodId === "string"
      ? patch.planningPeriodId
      : await ensureClientHasActivePeriod(clientId);

  if (typeof patch.defaultUsesReferences === "boolean") {
    await db
      .update(clients)
      .set({ defaultUsesReferences: patch.defaultUsesReferences, updatedAt: new Date() })
      .where(and(eq(clients.id, clientId), eq(clients.ownerUserId, userId)));
  }

  if (
    patch.periodUsesReferences === true ||
    patch.periodUsesReferences === false ||
    patch.periodUsesReferences === null
  ) {
    await updatePeriod(clientId, periodId, {
      usesReferences: patch.periodUsesReferences as boolean | null,
    });
  }

  if (typeof patch.startDate === "string") {
    const [periodRow] = await db
      .select({ startDate: planningPeriods.startDate })
      .from(planningPeriods)
      .where(eq(planningPeriods.id, periodId))
      .limit(1);
    if (periodRow && String(periodRow.startDate) !== patch.startDate) {
      const period = await getPeriodForClient(clientId, periodId);
      await updatePeriod(
        clientId,
        periodId,
        { startDate: patch.startDate },
        { allowArchived: period?.status === "archived" }
      );
    }
  }

  let brandGemChanged = false;
  if (patch.brandGem && typeof patch.brandGem === "object") {
    brandGemChanged = await syncBrandGemFromWorkspacePatch(
      userId,
      clientId,
      periodId,
      patch.brandGem as BrandGemPatchInput
    );
  }

  if (patch.ui && typeof patch.ui === "object") {
    const ui = patch.ui as Record<string, unknown>;
    await db
      .insert(clientUiPrefs)
      .values({
        userId,
        clientId,
        activeSection: typeof ui.activeSection === "string" ? ui.activeSection : null,
        activePreviewId: typeof ui.activePreviewId === "string" ? ui.activePreviewId : null,
        viewMode: typeof ui.viewMode === "string" ? ui.viewMode : null,
      })
      .onConflictDoUpdate({
        target: [clientUiPrefs.userId, clientUiPrefs.clientId],
        set: {
          activeSection: typeof ui.activeSection === "string" ? ui.activeSection : undefined,
          activePreviewId: typeof ui.activePreviewId === "string" ? ui.activePreviewId : undefined,
          viewMode: typeof ui.viewMode === "string" ? ui.viewMode : undefined,
        },
      });
  }

  const catalogIdRows =
    patch.canva || Array.isArray(patch.posts)
      ? await db
          .select({ id: catalogItems.id })
          .from(catalogItems)
          .where(
            and(eq(catalogItems.clientId, clientId), eq(catalogItems.planningPeriodId, periodId))
          )
      : [];
  const validCatalogIds = new Set(catalogIdRows.map((r) => r.id));

  if (patch.canva && typeof patch.canva === "object") {
    const canva = patch.canva as Record<string, unknown>;
    await db
      .update(canvaSettings)
      .set({
        activePageId: typeof canva.activePageId === "string" ? canva.activePageId : undefined,
        autoSync: typeof canva.autoSync === "boolean" ? canva.autoSync : undefined,
        reversed: typeof canva.reversed === "boolean" ? canva.reversed : undefined,
        gridFormat: typeof canva.gridFormat === "string" ? canva.gridFormat : undefined,
        gridMaxWidth: typeof canva.gridMaxWidth === "number" ? canva.gridMaxWidth : undefined,
      })
      .where(eq(canvaSettings.planningPeriodId, periodId));

    if (Array.isArray(canva.pages)) {
      const sentPageIds = new Set<string>();
      const pagesArr = canva.pages as Array<Record<string, unknown>>;

      for (let pageIndex = 0; pageIndex < pagesArr.length; pageIndex++) {
        const page = pagesArr[pageIndex]!;
        if (typeof page.id !== "string") continue;
        sentPageIds.add(page.id);
        const pageName = typeof page.name === "string" ? page.name : `Página ${pageIndex + 1}`;

        await db
          .insert(canvaPages)
          .values({
            id: page.id,
            clientId,
            planningPeriodId: periodId,
            name: pageName,
            sortOrder: pageIndex,
          })
          .onConflictDoUpdate({
            target: [canvaPages.planningPeriodId, canvaPages.id],
            set: { name: pageName, sortOrder: pageIndex },
          });

        if (!Array.isArray(page.slots)) continue;
        for (let slotIndex = 0; slotIndex < page.slots.length; slotIndex++) {
          const slot = page.slots[slotIndex] as Record<string, unknown>;
          if (typeof slot.id !== "string") continue;
          const label = typeof slot.label === "string" ? slot.label : `Look ${slotIndex + 1}`;
          const matchedCatalogId = sanitizeCatalogRefId(slot.matchedCatalogId, validCatalogIds);
          const imageAssetId =
            slot.imageAssetId === null || typeof slot.imageAssetId === "string"
              ? (slot.imageAssetId as string | null)
              : null;

          await db
            .insert(canvaSlots)
            .values({
              id: slot.id,
              clientId,
              planningPeriodId: periodId,
              pageId: page.id,
              slotIndex,
              label,
              matchedCatalogId,
              imageAssetId,
            })
            .onConflictDoUpdate({
              target: [canvaSlots.planningPeriodId, canvaSlots.id],
              set: { label, matchedCatalogId, imageAssetId, pageId: page.id, slotIndex },
            });
        }
      }

      const existingPages = await db
        .select({ id: canvaPages.id })
        .from(canvaPages)
        .where(eq(canvaPages.planningPeriodId, periodId));
      for (const row of existingPages) {
        if (!sentPageIds.has(row.id)) {
          await db
            .delete(canvaSlots)
            .where(
              and(eq(canvaSlots.planningPeriodId, periodId), eq(canvaSlots.pageId, row.id))
            );
          await db
            .delete(canvaPages)
            .where(and(eq(canvaPages.planningPeriodId, periodId), eq(canvaPages.id, row.id)));
        }
      }
    }
  }

  if (Array.isArray(patch.contentSchedule)) {
    await db
      .update(planningPeriods)
      .set({
        contentSchedule: patch.contentSchedule,
        updatedAt: new Date(),
      })
      .where(eq(planningPeriods.id, periodId));
  }

  if (typeof patch.contentScheduleBrief === "string") {
    await db
      .update(planningPeriods)
      .set({
        contentScheduleBrief: patch.contentScheduleBrief,
        updatedAt: new Date(),
      })
      .where(eq(planningPeriods.id, periodId));
  }

  if (Array.isArray(patch.posts)) {
    const sentPostIds = new Set<string>();
    const postsArr = patch.posts as Array<Record<string, unknown>>;

    for (const post of postsArr) {
      if (typeof post.id !== "string") continue;
      sentPostIds.add(post.id);
      const dayNumber =
        typeof post.dayNumber === "number"
          ? post.dayNumber
          : parseInt(post.id.replace(/\D/g, ""), 10) || 1;
      const dateLabel = typeof post.dateLabel === "string" ? post.dateLabel : `Dia ${dayNumber}`;
      const matchedCatalogId = sanitizeCatalogRefId(post.matchedCatalogId, validCatalogIds);
      const reasoning =
        post.reasoning === null || typeof post.reasoning === "string"
          ? (post.reasoning as string | null)
          : null;
      const caption = typeof post.caption === "string" ? post.caption : "";
      const isGenerated = typeof post.isGenerated === "boolean" ? post.isGenerated : false;
      const isConfirmed = typeof post.isConfirmed === "boolean" ? post.isConfirmed : false;
      const captionFromImageOnly =
        typeof post.captionFromImageOnly === "boolean" ? post.captionFromImageOnly : false;
      const captionFromSchedule =
        typeof post.captionFromSchedule === "boolean" ? post.captionFromSchedule : false;
      const captionModel =
        post.captionModel === null || typeof post.captionModel === "string"
          ? (post.captionModel as string | null)
          : null;
      const structuredCopy =
        post.structuredCopy !== null &&
        typeof post.structuredCopy === "object" &&
        !Array.isArray(post.structuredCopy)
          ? post.structuredCopy
          : null;
      const lastError =
        post.error === null || typeof post.error === "string"
          ? (post.error as string | null)
          : null;
      const imageAssetId =
        post.imageAssetId === null || typeof post.imageAssetId === "string"
          ? (post.imageAssetId as string | null)
          : null;
      const canvaSlotId =
        post.canvaSlotRef &&
        typeof post.canvaSlotRef === "object" &&
        post.canvaSlotRef !== null &&
        typeof (post.canvaSlotRef as { slotId?: string }).slotId === "string"
          ? (post.canvaSlotRef as { slotId: string }).slotId
          : post.canvaSlotId === null || typeof post.canvaSlotId === "string"
            ? (post.canvaSlotId as string | null)
            : null;

      await db
        .insert(plannedPosts)
        .values({
          id: post.id,
          clientId,
          planningPeriodId: periodId,
          dayNumber,
          dateLabel,
          matchedCatalogId,
          reasoning,
          caption,
          isGenerated,
          isConfirmed,
          captionFromImageOnly,
          captionFromSchedule,
          captionModel,
          structuredCopy,
          lastError,
          imageAssetId,
          canvaSlotId,
        })
        .onConflictDoUpdate({
          target: [plannedPosts.planningPeriodId, plannedPosts.id],
          set: {
            dayNumber,
            dateLabel,
            matchedCatalogId,
            reasoning,
            caption,
            isGenerated,
            isConfirmed,
            captionFromImageOnly,
            captionFromSchedule,
            captionModel,
            structuredCopy,
            lastError,
            imageAssetId,
            canvaSlotId,
          },
        });
    }

    const existingPosts = await db
      .select({ id: plannedPosts.id })
      .from(plannedPosts)
      .where(eq(plannedPosts.planningPeriodId, periodId));
    for (const row of existingPosts) {
      if (!sentPostIds.has(row.id)) {
        await db
          .delete(plannedPosts)
          .where(
            and(eq(plannedPosts.planningPeriodId, periodId), eq(plannedPosts.id, row.id))
          );
      }
    }

    await db
      .update(planningPeriods)
      .set({ updatedAt: new Date() })
      .where(eq(planningPeriods.id, periodId));
  }

  const domains: ("workspace" | "brandGem")[] = ["workspace"];
  if (brandGemChanged) domains.push("brandGem");
  serverSyncDebugLog("patch.workspace", {
    clientId,
    periodId,
    domains,
    brandGemChanged,
  });
  void emitClientSync(userId, clientId, domains, periodId);
}

export async function resetClientWorkspace(userId: string, clientId: string) {
  const db = getDb();
  const periodId = await getActivePeriodId(clientId);
  if (!periodId) throw new Error("Nenhum roteiro ativo.");
  await resetPeriod(clientId, periodId);

  const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  await db
    .update(brandGems)
    .set({
      name: client?.name ?? clientId,
      description: "",
      instructions: "",
      captionParams: {},
      footer: {
        structure: "",
        address: "",
        contact: "",
        hashtags: "",
        extra: "",
        customFields: [],
      },
      savedAt: null,
    })
    .where(eq(brandGems.clientId, clientId));

  void emitClientSync(userId, clientId, ["catalog", "workspace", "brandGem", "periods"], periodId);
}

export { getActivePeriodId };
