import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { GEMINI_EMBEDDING_DIMENSIONS, getGeminiEmbeddingModel } from "../ai/matchConfig";
import { getDb, getSqlClient } from "../db/client";
import { catalogItems } from "../db/schema";
import { mediaPublicUrl, deleteMediaAssetsIfUnreferenced } from "./mediaService";

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
  const [item] = await db
    .select({ imageAssetId: catalogItems.imageAssetId })
    .from(catalogItems)
    .where(and(eq(catalogItems.clientId, clientId), eq(catalogItems.id, id)))
    .limit(1);

  await db
    .delete(catalogItems)
    .where(and(eq(catalogItems.clientId, clientId), eq(catalogItems.id, id)));

  if (item?.imageAssetId) {
    await deleteMediaAssetsIfUnreferenced([item.imageAssetId]);
  }
}

export async function clearCatalog(clientId: string) {
  const db = getDb();
  const rows = await db
    .select({ imageAssetId: catalogItems.imageAssetId })
    .from(catalogItems)
    .where(eq(catalogItems.clientId, clientId));

  const assetIds = rows
    .map((r) => r.imageAssetId)
    .filter((id): id is string => !!id);

  await db.delete(catalogItems).where(eq(catalogItems.clientId, clientId));

  if (assetIds.length > 0) {
    await deleteMediaAssetsIfUnreferenced(assetIds);
  }
}

export async function clearGridCatalog(clientId: string) {
  const db = getDb();
  const rows = await db
    .select({ imageAssetId: catalogItems.imageAssetId })
    .from(catalogItems)
    .where(and(eq(catalogItems.clientId, clientId), eq(catalogItems.isReference, false)));

  const assetIds = rows
    .map((r) => r.imageAssetId)
    .filter((id): id is string => !!id);

  await db
    .delete(catalogItems)
    .where(and(eq(catalogItems.clientId, clientId), eq(catalogItems.isReference, false)));

  if (assetIds.length > 0) {
    await deleteMediaAssetsIfUnreferenced(assetIds);
  }
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

  if (ids && ids.length > 0) {
    await db.execute(sql`
      UPDATE catalog_items
      SET image_embedding = NULL, embedding_model = NULL, embedded_at = NULL
      WHERE client_id = ${clientId} AND id IN (${sql.join(
        ids.map((id) => sql`${id}`),
        sql`, `
      )})
    `);
  } else {
    await db.execute(sql`
      UPDATE catalog_items
      SET image_embedding = NULL, embedding_model = NULL, embedded_at = NULL
      WHERE client_id = ${clientId}
    `);
  }
}

function vectorLiteral(values: number[]): string {
  return `[${values.map((v) => Number(v).toFixed(8)).join(",")}]`;
}

function sqlEscape(value: string): string {
  return value.replace(/'/g, "''");
}

export async function updateCatalogEmbedding(
  clientId: string,
  id: string,
  embedding: number[],
  model?: string
) {
  if (embedding.length !== GEMINI_EMBEDDING_DIMENSIONS) {
    throw new Error(
      `embedding com ${embedding.length} dimensões (esperado ${GEMINI_EMBEDDING_DIMENSIONS})`
    );
  }
  const lit = vectorLiteral(embedding);
  const modelName = model ?? getGeminiEmbeddingModel();
  const sql = getSqlClient();
  await sql.unsafe(`
    UPDATE catalog_items
    SET
      image_embedding = '${lit}'::vector,
      embedding_model = '${sqlEscape(modelName)}',
      embedded_at = NOW(),
      updated_at = NOW()
    WHERE client_id = '${sqlEscape(clientId)}' AND id = '${sqlEscape(id)}'
  `);
}

export async function searchCatalogByEmbedding(
  clientId: string,
  queryEmbedding: number[],
  limit: number
): Promise<string[]> {
  const lit = vectorLiteral(queryEmbedding);
  const sql = getSqlClient();
  const rows = await sql.unsafe<{ id: string }>(`
    SELECT id
    FROM catalog_items
    WHERE client_id = '${sqlEscape(clientId)}'
      AND is_reference = true
      AND image_embedding IS NOT NULL
    ORDER BY image_embedding <=> '${lit}'::vector
    LIMIT ${Math.max(1, Math.min(limit, 80))}
  `);
  return rows.map((r) => r.id);
}

export async function countCatalogEmbeddings(clientId: string): Promise<number> {
  const db = getDb();
  const rows = await db.execute<{ count: string }>(sql`
    SELECT COUNT(*)::text AS count
    FROM catalog_items
    WHERE client_id = ${clientId}
      AND is_reference = true
      AND image_embedding IS NOT NULL
  `);
  return Number.parseInt(rows[0]?.count ?? "0", 10);
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
