/**
 * Remove media_assets órfãos de um cliente (sem referência em catálogo, grid ou posts).
 * Uso: node scripts/purge-orphan-media.mjs [clientId]
 */
import "dotenv/config";
import postgres from "postgres";

const clientId = process.argv[2] || "palak-br";
const sql = postgres(process.env.DATABASE_URL, { max: 1 });

try {
  const orphans = await sql`
    SELECT m.id, m.object_key
    FROM media_assets m
    WHERE m.client_id = ${clientId}
      AND NOT EXISTS (
        SELECT 1 FROM catalog_items c WHERE c.image_asset_id = m.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM canva_slots s WHERE s.image_asset_id = m.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM planned_posts p WHERE p.image_asset_id = m.id
      )
  `;

  console.log(`Órfãos encontrados para ${clientId}: ${orphans.length}`);

  if (orphans.length === 0) {
    process.exit(0);
  }

  const ids = orphans.map((r) => r.id);
  const deleted = await sql`
    DELETE FROM media_assets
    WHERE id = ANY(${ids}::uuid[])
  `;

  console.log(`Removidos do banco: ${deleted.count}`);
  console.log(
    "Nota: blobs no Square Cloud não são apagados por este script.",
    "Use POST /api/v1/clients/:clientId/media/purge-orphans autenticado para limpar blob + banco."
  );
} finally {
  await sql.end();
}
