import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { GEMINI_EMBEDDING_DIMENSIONS, getGeminiEmbeddingModel } from "../ai/matchConfig";
import { getDb, getSqlClient } from "../db/client";
import { catalogItems } from "../db/schema";
import { ensureClientHasActivePeriod } from "./planningPeriodService";
import { mediaPublicUrl, deleteMediaAssetsIfUnreferenced } from "./mediaService";

async function resolvePeriodId(clientId: string, planningPeriodId?: string | null) {
  return planningPeriodId ?? (await ensureClientHasActivePeriod(clientId));
}

function periodWhere(clientId: string, periodId: string) {
  return and(eq(catalogItems.clientId, clientId), eq(catalogItems.planningPeriodId, periodId));
}

export async function listCatalogItems(clientId: string, planningPeriodId?: string | null) {
  const db = getDb();
  const periodId = await resolvePeriodId(clientId, planningPeriodId);
  const rows = await db
    .select()
    .from(catalogItems)
    .where(periodWhere(clientId, periodId))
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
  planningPeriodId?: string | null;
}) {
  const db = getDb();
  const periodId = await resolvePeriodId(input.clientId, input.planningPeriodId);
  const [row] = await db
    .insert(catalogItems)
    .values({
      id: input.id,
      clientId: input.clientId,
      planningPeriodId: periodId,
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
  }>,
  planningPeriodId?: string | null
) {
  const db = getDb();
  const periodId = await resolvePeriodId(clientId, planningPeriodId);
  const [row] = await db
    .update(catalogItems)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(periodWhere(clientId, periodId), eq(catalogItems.id, id)))
    .returning();
  if (!row) throw new Error("Referência não encontrada.");
  return mapCatalogRow(row);
}

export async function deleteCatalogItem(
  clientId: string,
  id: string,
  planningPeriodId?: string | null
) {
  const db = getDb();
  const periodId = await resolvePeriodId(clientId, planningPeriodId);
  const [item] = await db
    .select({ imageAssetId: catalogItems.imageAssetId })
    .from(catalogItems)
    .where(and(periodWhere(clientId, periodId), eq(catalogItems.id, id)))
    .limit(1);

  await db
    .delete(catalogItems)
    .where(and(periodWhere(clientId, periodId), eq(catalogItems.id, id)));

  if (item?.imageAssetId) {
    await deleteMediaAssetsIfUnreferenced([item.imageAssetId]);
  }
}

export async function clearCatalog(clientId: string, planningPeriodId?: string | null) {
  const db = getDb();
  const periodId = await resolvePeriodId(clientId, planningPeriodId);
  const rows = await db
    .select({ imageAssetId: catalogItems.imageAssetId })
    .from(catalogItems)
    .where(periodWhere(clientId, periodId));

  const assetIds = rows.map((r) => r.imageAssetId).filter((id): id is string => !!id);

  await db.delete(catalogItems).where(periodWhere(clientId, periodId));

  if (assetIds.length > 0) {
    await deleteMediaAssetsIfUnreferenced(assetIds);
  }
}

export async function clearGridCatalog(clientId: string, planningPeriodId?: string | null) {
  const db = getDb();
  const periodId = await resolvePeriodId(clientId, planningPeriodId);
  const rows = await db
    .select({ imageAssetId: catalogItems.imageAssetId })
    .from(catalogItems)
    .where(
      and(periodWhere(clientId, periodId), eq(catalogItems.isReference, false))
    );

  const assetIds = rows.map((r) => r.imageAssetId).filter((id): id is string => !!id);

  await db
    .delete(catalogItems)
    .where(and(periodWhere(clientId, periodId), eq(catalogItems.isReference, false)));

  if (assetIds.length > 0) {
    await deleteMediaAssetsIfUnreferenced(assetIds);
  }
}

export async function clearCatalogEnrichments(
  clientId: string,
  ids?: string[],
  planningPeriodId?: string | null
) {
  const db = getDb();
  const periodId = await resolvePeriodId(clientId, planningPeriodId);
  const where =
    ids && ids.length > 0
      ? and(periodWhere(clientId, periodId), inArray(catalogItems.id, ids))
      : periodWhere(clientId, periodId);

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
      WHERE client_id = ${clientId}
        AND planning_period_id = ${periodId}
        AND id IN (${sql.join(
          ids.map((id) => sql`${id}`),
          sql`, `
        )})
    `);
  } else {
    await db.execute(sql`
      UPDATE catalog_items
      SET image_embedding = NULL, embedding_model = NULL, embedded_at = NULL
      WHERE client_id = ${clientId} AND planning_period_id = ${periodId}
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
  model?: string,
  planningPeriodId?: string | null
) {
  if (embedding.length !== GEMINI_EMBEDDING_DIMENSIONS) {
    throw new Error(
      `embedding com ${embedding.length} dimensões (esperado ${GEMINI_EMBEDDING_DIMENSIONS})`
    );
  }
  const periodId = await resolvePeriodId(clientId, planningPeriodId);
  const lit = vectorLiteral(embedding);
  const modelName = model ?? getGeminiEmbeddingModel();
  const sqlClient = getSqlClient();
  await sqlClient.unsafe(`
    UPDATE catalog_items
    SET
      image_embedding = '${lit}'::vector,
      embedding_model = '${sqlEscape(modelName)}',
      embedded_at = NOW(),
      updated_at = NOW()
    WHERE client_id = '${sqlEscape(clientId)}'
      AND planning_period_id = '${sqlEscape(periodId)}'
      AND id = '${sqlEscape(id)}'
  `);
}

export async function searchCatalogByEmbedding(
  clientId: string,
  queryEmbedding: number[],
  limit: number,
  planningPeriodId?: string | null
): Promise<string[]> {
  const periodId = await resolvePeriodId(clientId, planningPeriodId);
  const lit = vectorLiteral(queryEmbedding);
  const sqlClient = getSqlClient();
  const rows = (await sqlClient.unsafe(`
    SELECT id
    FROM catalog_items
    WHERE client_id = '${sqlEscape(clientId)}'
      AND planning_period_id = '${sqlEscape(periodId)}'
      AND is_reference = true
      AND image_embedding IS NOT NULL
    ORDER BY image_embedding <=> '${lit}'::vector
    LIMIT ${Math.max(1, Math.min(limit, 80))}
  `)) as { id: string }[];
  return rows.map((r) => r.id);
}

export async function countCatalogEmbeddings(
  clientId: string,
  planningPeriodId?: string | null
): Promise<number> {
  const db = getDb();
  const periodId = await resolvePeriodId(clientId, planningPeriodId);
  const rows = await db.execute<{ count: string }>(sql`
    SELECT COUNT(*)::text AS count
    FROM catalog_items
    WHERE client_id = ${clientId}
      AND planning_period_id = ${periodId}
      AND is_reference = true
      AND image_embedding IS NOT NULL
  `);
  return Number.parseInt(rows[0]?.count ?? "0", 10);
}

export async function getCatalogItem(
  clientId: string,
  id: string,
  planningPeriodId?: string | null
) {
  const db = getDb();
  const periodId = await resolvePeriodId(clientId, planningPeriodId);
  const [row] = await db
    .select()
    .from(catalogItems)
    .where(and(periodWhere(clientId, periodId), eq(catalogItems.id, id)))
    .limit(1);
  return row ? mapCatalogRow(row) : null;
}

export async function getCatalogProfiles(clientId: string, planningPeriodId?: string | null) {
  const db = getDb();
  const periodId = await resolvePeriodId(clientId, planningPeriodId);
  const rows = await db
    .select()
    .from(catalogItems)
    .where(
      and(
        periodWhere(clientId, periodId),
        eq(catalogItems.enrichmentStatus, "ready")
      )
    );
  return rows
    .filter((r) => r.visualProfile)
    .map((r) => ({ id: r.id, label: r.label, profile: r.visualProfile }));
}
