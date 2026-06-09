import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../db/client";
import { catalogItems } from "../db/schema";
import { mediaPublicUrl } from "./mediaService";

export async function listCatalogItems(clientId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(catalogItems)
    .where(eq(catalogItems.clientId, clientId))
    .orderBy(desc(catalogItems.createdAt));
  return rows.map(mapCatalogRow);
}

function mapCatalogRow(c: typeof catalogItems.$inferSelect) {
  return {
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
  };
}

export async function createCatalogItem(input: {
  clientId: string;
  id: string;
  label: string;
  description?: string;
  imageAssetId: string;
  isReference?: boolean;
}) {
  const db = getDb();
  const [row] = await db
    .insert(catalogItems)
    .values({
      id: input.id,
      clientId: input.clientId,
      label: input.label,
      description: input.description,
      imageAssetId: input.imageAssetId,
      isReference: input.isReference ?? true,
      enrichmentStatus: "pending",
    })
    .returning();
  return mapCatalogRow(row!);
}

export async function updateCatalogItem(
  clientId: string,
  id: string,
  patch: Partial<{
    label: string;
    description: string;
    visualProfile: unknown;
    enrichmentStatus: string;
    enrichedAt: Date | null;
    enrichmentError: string | null;
    imageAssetId: string | null;
  }>
) {
  const db = getDb();
  const [row] = await db
    .update(catalogItems)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(catalogItems.clientId, clientId), eq(catalogItems.id, id)))
    .returning();
  if (!row) throw new Error("Referência não encontrada.");
  return mapCatalogRow(row);
}

export async function deleteCatalogItem(clientId: string, id: string) {
  const db = getDb();
  await db
    .delete(catalogItems)
    .where(and(eq(catalogItems.clientId, clientId), eq(catalogItems.id, id)));
}

export async function clearCatalog(clientId: string) {
  const db = getDb();
  await db.delete(catalogItems).where(eq(catalogItems.clientId, clientId));
}

export async function clearCatalogEnrichments(clientId: string, ids?: string[]) {
  const db = getDb();
  const where =
    ids && ids.length > 0
      ? and(eq(catalogItems.clientId, clientId), inArray(catalogItems.id, ids))
      : eq(catalogItems.clientId, clientId);

  await db
    .update(catalogItems)
    .set({
      visualProfile: null,
      enrichmentStatus: "pending",
      enrichedAt: null,
      enrichmentError: null,
      updatedAt: new Date(),
    })
    .where(where);
}

export async function getCatalogItem(clientId: string, id: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(catalogItems)
    .where(and(eq(catalogItems.clientId, clientId), eq(catalogItems.id, id)))
    .limit(1);
  return row ? mapCatalogRow(row) : null;
}

export async function getCatalogProfiles(clientId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(catalogItems)
    .where(
      and(eq(catalogItems.clientId, clientId), eq(catalogItems.enrichmentStatus, "ready"))
    );
  return rows
    .filter((r) => r.visualProfile)
    .map((r) => ({ id: r.id, label: r.label, profile: r.visualProfile }));
}
