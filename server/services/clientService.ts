import { and, asc, desc, eq, isNull } from "drizzle-orm";
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
  userClientState,
} from "../db/schema";
import { mediaPublicUrl } from "./mediaService";

const DEFAULT_START_DATE = "2026-05-24";
const POST_COUNT = 30;

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

function defaultCanvaPages(clientId: string) {
  const pageDefs = [
    { id: "page_1", name: "Página 1", sortOrder: 0 },
    { id: "page_2", name: "Página 2", sortOrder: 1 },
    { id: "page_3", name: "Página 3", sortOrder: 2 },
    { id: "page_4", name: "Página 4", sortOrder: 3 },
  ];
  const pages = pageDefs.map((p) => ({ ...p, clientId }));
  const slots = pageDefs.flatMap((p) =>
    Array.from({ length: 12 }, (_, i) => ({
      id: `slot_${p.id}_${i}`,
      clientId,
      pageId: p.id,
      slotIndex: i,
      label: `Look ${i + 1}`,
      matchedCatalogId: null as string | null,
      imageAssetId: null as string | null,
    }))
  );
  return { pages, slots, activePageId: "page_4" };
}

function defaultPosts(clientId: string) {
  return Array.from({ length: POST_COUNT }, (_, i) => {
    const day = i + 1;
    return {
      id: `post_day${day}`,
      clientId,
      dayNumber: day,
      dateLabel: `Dia ${day}`,
      imageAssetId: null as string | null,
      canvaSlotId: null as string | null,
      matchedCatalogId: null as string | null,
      reasoning: null as string | null,
      caption: "",
      isGenerated: false,
      isConfirmed: false,
      captionFromImageOnly: false,
      lastError: null as string | null,
    };
  });
}

export async function listClientsForUser(userId: string) {
  const db = getDb();
  return db
    .select()
    .from(clients)
    .where(and(eq(clients.ownerUserId, userId), isNull(clients.deletedAt)))
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
    startDate: DEFAULT_START_DATE,
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

  const { pages, slots, activePageId } = defaultCanvaPages(id);
  await db.insert(canvaSettings).values({
    clientId: id,
    activePageId,
    autoSync: true,
    reversed: true,
    gridFormat: "square",
    gridMaxWidth: 480,
  });
  await db.insert(canvaPages).values(pages);
  await db.insert(canvaSlots).values(slots);
  await db.insert(plannedPosts).values(defaultPosts(id));

  await db
    .insert(userClientState)
    .values({ userId, activeClientId: id })
    .onConflictDoUpdate({
      target: userClientState.userId,
      set: { activeClientId: id },
    });

  return { id, name: displayName };
}

export async function setActiveClient(userId: string, clientId: string) {
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
}

export async function loadWorkspaceDto(userId: string, clientId: string) {
  const db = getDb();

  const [client] = await db
    .select()
    .from(clients)
    .where(
      and(eq(clients.id, clientId), eq(clients.ownerUserId, userId), isNull(clients.deletedAt))
    )
    .limit(1);
  if (!client) throw new Error("Cliente não encontrado.");

  const [gem] = await db.select().from(brandGems).where(eq(brandGems.clientId, clientId)).limit(1);
  const [canvaCfg] = await db
    .select()
    .from(canvaSettings)
    .where(eq(canvaSettings.clientId, clientId))
    .limit(1);
  const pages = await db
    .select()
    .from(canvaPages)
    .where(eq(canvaPages.clientId, clientId))
    .orderBy(asc(canvaPages.sortOrder));
  const slots = await db
    .select()
    .from(canvaSlots)
    .where(eq(canvaSlots.clientId, clientId))
    .orderBy(asc(canvaSlots.slotIndex));
  const catalog = await db
    .select()
    .from(catalogItems)
    .where(eq(catalogItems.clientId, clientId))
    .orderBy(desc(catalogItems.createdAt));
  const posts = await db
    .select()
    .from(plannedPosts)
    .where(eq(plannedPosts.clientId, clientId))
    .orderBy(asc(plannedPosts.dayNumber));
  const [ui] = await db
    .select()
    .from(clientUiPrefs)
    .where(and(eq(clientUiPrefs.userId, userId), eq(clientUiPrefs.clientId, clientId)))
    .limit(1);

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
      | "failed"
      | undefined,
    enrichedAt: c.enrichedAt?.toISOString(),
    enrichmentError: c.enrichmentError ?? undefined,
  }));

  const slotDtos = slots.map((s) => ({
    id: s.id,
    image: s.imageAssetId ? mediaPublicUrl(s.imageAssetId) : null,
    imageAssetId: s.imageAssetId,
    label: s.label,
    matchedCatalogId: s.matchedCatalogId,
  }));

  const pageDtos = pages.map((p) => ({
    id: p.id,
    name: p.name,
    slots: slotDtos.filter((s) => slots.find((row) => row.id === s.id && row.pageId === p.id)),
  }));

  // Fix page slots grouping
  const pagesWithSlots = pages.map((p) => ({
    id: p.id,
    name: p.name,
    slots: slots
      .filter((s) => s.pageId === p.id)
      .map((s) => ({
        id: s.id,
        image: s.imageAssetId ? mediaPublicUrl(s.imageAssetId) : null,
        imageAssetId: s.imageAssetId,
        label: s.label,
        matchedCatalogId: s.matchedCatalogId,
      })),
  }));

  const postsDto = posts.map((p) => ({
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
    canvaSlotRef: p.canvaSlotId ? { pageId: findPageForSlot(slots, p.canvaSlotId), slotId: p.canvaSlotId } : null,
    captionFromImageOnly: p.captionFromImageOnly,
  }));

  return {
    version: 1 as const,
    client: {
      id: client.id,
      name: client.name,
      instagramHandle: client.instagramHandle ?? client.id.replace(/-/g, "_"),
      createdAt: client.createdAt.toISOString(),
      updatedAt: client.updatedAt.toISOString(),
    },
    brandGem: {
      id: clientId,
      name: gem?.name ?? client.name,
      description: gem?.description ?? "",
      instructions: gem?.instructions ?? "",
      campaignContext: gem?.campaignContext ?? "",
      captionParams: gem?.captionParams ?? {},
      footer: gem?.footer ?? {},
    },
    catalog: catalogDto,
    posts: postsDto,
    startDate: client.startDate,
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
}

function findPageForSlot(
  slots: { id: string; pageId: string }[],
  slotId: string
): string {
  return slots.find((s) => s.id === slotId)?.pageId ?? "page_1";
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
  await db
    .update(brandGems)
    .set({
      name: gem.name,
      description: gem.description,
      instructions: gem.instructions,
      campaignContext: gem.campaignContext ?? "",
      captionParams: gem.captionParams ?? {},
      footer: gem.footer ?? {},
      savedAt,
    })
    .where(eq(brandGems.clientId, clientId));
  await db.update(clients).set({ updatedAt: new Date() }).where(eq(clients.id, clientId));
  return savedAt.toISOString();
}

export async function patchWorkspace(
  userId: string,
  clientId: string,
  patch: Record<string, unknown>
) {
  const db = getDb();

  if (typeof patch.startDate === "string") {
    await db
      .update(clients)
      .set({ startDate: patch.startDate, updatedAt: new Date() })
      .where(eq(clients.id, clientId));
  }

  if (patch.brandGem && typeof patch.brandGem === "object") {
    await saveBrandGem(userId, clientId, patch.brandGem as Parameters<typeof saveBrandGem>[2]);
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

  if (patch.canva && typeof patch.canva === "object") {
    const canva = patch.canva as Record<string, unknown>;
    await db
      .update(canvaSettings)
      .set({
        activePageId:
          typeof canva.activePageId === "string" ? canva.activePageId : undefined,
        autoSync: typeof canva.autoSync === "boolean" ? canva.autoSync : undefined,
        reversed: typeof canva.reversed === "boolean" ? canva.reversed : undefined,
        gridFormat: typeof canva.gridFormat === "string" ? canva.gridFormat : undefined,
        gridMaxWidth: typeof canva.gridMaxWidth === "number" ? canva.gridMaxWidth : undefined,
      })
      .where(eq(canvaSettings.clientId, clientId));

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
            name: pageName,
            sortOrder: pageIndex,
          })
          .onConflictDoUpdate({
            target: [canvaPages.clientId, canvaPages.id],
            set: { name: pageName, sortOrder: pageIndex },
          });

        if (!Array.isArray(page.slots)) continue;
        for (let slotIndex = 0; slotIndex < page.slots.length; slotIndex++) {
          const slot = page.slots[slotIndex] as Record<string, unknown>;
          if (typeof slot.id !== "string") continue;
          const label =
            typeof slot.label === "string" ? slot.label : `Look ${slotIndex + 1}`;
          const matchedCatalogId =
            slot.matchedCatalogId === null || typeof slot.matchedCatalogId === "string"
              ? (slot.matchedCatalogId as string | null)
              : null;
          const imageAssetId =
            slot.imageAssetId === null || typeof slot.imageAssetId === "string"
              ? (slot.imageAssetId as string | null)
              : null;

          await db
            .insert(canvaSlots)
            .values({
              id: slot.id,
              clientId,
              pageId: page.id,
              slotIndex,
              label,
              matchedCatalogId,
              imageAssetId,
            })
            .onConflictDoUpdate({
              target: [canvaSlots.clientId, canvaSlots.id],
              set: { label, matchedCatalogId, imageAssetId, pageId: page.id, slotIndex },
            });
        }
      }

      const existingPages = await db
        .select({ id: canvaPages.id })
        .from(canvaPages)
        .where(eq(canvaPages.clientId, clientId));
      for (const row of existingPages) {
        if (!sentPageIds.has(row.id)) {
          await db
            .delete(canvaSlots)
            .where(and(eq(canvaSlots.clientId, clientId), eq(canvaSlots.pageId, row.id)));
          await db
            .delete(canvaPages)
            .where(and(eq(canvaPages.clientId, clientId), eq(canvaPages.id, row.id)));
        }
      }
    }
  }

  if (Array.isArray(patch.posts)) {
    for (const post of patch.posts as Array<Record<string, unknown>>) {
      if (typeof post.id !== "string") continue;
      const dayNumber =
        typeof post.dayNumber === "number" ? post.dayNumber : parseInt(post.id.replace(/\D/g, ""), 10) || 1;
      const dateLabel =
        typeof post.dateLabel === "string" ? post.dateLabel : `Dia ${dayNumber}`;
      const matchedCatalogId =
        post.matchedCatalogId === null || typeof post.matchedCatalogId === "string"
          ? (post.matchedCatalogId as string | null)
          : null;
      const reasoning =
        post.reasoning === null || typeof post.reasoning === "string"
          ? (post.reasoning as string | null)
          : null;
      const caption = typeof post.caption === "string" ? post.caption : "";
      const isGenerated = typeof post.isGenerated === "boolean" ? post.isGenerated : false;
      const isConfirmed = typeof post.isConfirmed === "boolean" ? post.isConfirmed : false;
      const captionFromImageOnly =
        typeof post.captionFromImageOnly === "boolean" ? post.captionFromImageOnly : false;
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
          dayNumber,
          dateLabel,
          matchedCatalogId,
          reasoning,
          caption,
          isGenerated,
          isConfirmed,
          captionFromImageOnly,
          lastError,
          imageAssetId,
          canvaSlotId,
        })
        .onConflictDoUpdate({
          target: [plannedPosts.clientId, plannedPosts.id],
          set: {
            dayNumber,
            dateLabel,
            matchedCatalogId,
            reasoning,
            caption,
            isGenerated,
            isConfirmed,
            captionFromImageOnly,
            lastError,
            imageAssetId,
            canvaSlotId,
          },
        });
    }
  }

  await db.update(clients).set({ updatedAt: new Date() }).where(eq(clients.id, clientId));
}

export async function resetClientWorkspace(userId: string, clientId: string) {
  const db = getDb();
  await db.delete(catalogItems).where(eq(catalogItems.clientId, clientId));
  await db.delete(plannedPosts).where(eq(plannedPosts.clientId, clientId));
  await db.delete(canvaSlots).where(eq(canvaSlots.clientId, clientId));
  await db.delete(canvaPages).where(eq(canvaPages.clientId, clientId));
  await db.delete(canvaSettings).where(eq(canvaSettings.clientId, clientId));

  const { pages, slots, activePageId } = defaultCanvaPages(clientId);
  await db.insert(canvaSettings).values({
    clientId,
    activePageId,
    autoSync: true,
    reversed: true,
    gridFormat: "square",
    gridMaxWidth: 480,
  });
  await db.insert(canvaPages).values(pages);
  await db.insert(canvaSlots).values(slots);
  await db.insert(plannedPosts).values(defaultPosts(clientId));

  const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  await db
    .update(brandGems)
    .set({
      name: client?.name ?? clientId,
      description: "",
      instructions: "",
      campaignContext: "",
      captionParams: {},
      footer: { structure: "", address: "", contact: "", hashtags: "", extra: "", customFields: [] },
      savedAt: null,
    })
    .where(eq(brandGems.clientId, clientId));
}
