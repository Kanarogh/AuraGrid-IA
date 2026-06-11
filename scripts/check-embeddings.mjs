import "dotenv/config";
import postgres from "postgres";
import { GoogleGenAI } from "@google/genai";

const clientId = process.argv[2] || "mia";
const sql = postgres(process.env.DATABASE_URL, { max: 1 });

try {
  const stats = await sql`
    SELECT
      enrichment_status,
      COUNT(*)::int AS total,
      COUNT(image_embedding)::int AS with_embedding
    FROM catalog_items
    WHERE client_id = ${clientId} AND is_reference = true
    GROUP BY enrichment_status
  `;
  console.log("stats:", stats);

  const sample = await sql`
    SELECT id, label, enrichment_status, image_embedding IS NOT NULL AS has_emb, embedding_model
    FROM catalog_items
    WHERE client_id = ${clientId} AND is_reference = true
    ORDER BY updated_at DESC
    LIMIT 5
  `;
  console.log("sample:", sample);

  if (!process.env.GEMINI_API_KEY?.trim()) {
    console.log("GEMINI_API_KEY: ausente");
    process.exit(0);
  }
  console.log("GEMINI_API_KEY: ok");

  const [row] = await sql`
    SELECT c.id, c.label, m.bucket, m.object_key, m.mime_type
    FROM catalog_items c
    JOIN media_assets m ON m.id = c.image_asset_id
    WHERE c.client_id = ${clientId}
      AND c.enrichment_status = 'ready'
      AND c.image_asset_id IS NOT NULL
    LIMIT 1
  `;
  if (!row) {
    console.log("sem item ready com imagem");
    process.exit(0);
  }

  const endpoint = process.env.MINIO_ENDPOINT || "localhost";
  const port = process.env.MINIO_PORT || "9000";
  const url = `http://${endpoint}:${port}/${row.bucket}/${row.object_key}`;
  const res = await fetch(url);
  console.log("fetch imagem:", res.status, row.label);
  if (!res.ok) process.exit(1);

  const data = Buffer.from(await res.arrayBuffer()).toString("base64");
  const mime = row.mime_type || "image/jpeg";
  const model = process.env.GEMINI_EMBEDDING_MODEL?.trim() || "gemini-embedding-2";
  const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY.trim() });

  try {
    const response = await genai.models.embedContent({
      model,
      contents: [
        {
          parts: [
            { text: "task: search document | query: fashion catalog reference garment" },
            { inlineData: { mimeType: mime, data } },
          ],
        },
      ],
      config: { outputDimensionality: 768 },
    });
    const values = response.embeddings?.[0]?.values;
    console.log("embed ok, dims:", values?.length ?? 0);
  } catch (e) {
    console.error("embed API erro:", e?.message || e);
  }
} finally {
  await sql.end({ timeout: 5 });
}
