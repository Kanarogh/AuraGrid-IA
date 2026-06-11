/**
 * Gera embeddings Gemini para referências já indexadas (sem reindexar JSON).
 * Uso: node scripts/backfill-embeddings.mjs [clientId]
 */
import "dotenv/config";
import postgres from "postgres";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { GoogleGenAI } from "@google/genai";

const clientId = process.argv[2];
const databaseUrl = process.env.DATABASE_URL;
const apiKey = process.env.GEMINI_API_KEY?.trim();
const model = process.env.GEMINI_EMBEDDING_MODEL?.trim() || "gemini-embedding-2";
const dims = 768;

if (!databaseUrl) {
  console.error("DATABASE_URL não definida.");
  process.exit(1);
}
if (!apiKey) {
  console.error("GEMINI_API_KEY não definida.");
  process.exit(1);
}
if (!clientId) {
  console.error("Uso: node scripts/backfill-embeddings.mjs <clientId>");
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1 });
const genai = new GoogleGenAI({ apiKey });
const s3 = new S3Client({
  endpoint: `http://${process.env.MINIO_ENDPOINT || "localhost"}:${process.env.MINIO_PORT || "9000"}`,
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || "auragrid",
    secretAccessKey: process.env.MINIO_SECRET_KEY || "auragridsecret",
  },
  forcePathStyle: true,
});

function vectorLiteral(values) {
  return `[${values.map((v) => Number(v).toFixed(8)).join(",")}]`;
}

async function loadImageFromMinio(bucket, objectKey) {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }));
  const chunks = [];
  for await (const c of res.Body) chunks.push(c);
  const buf = Buffer.concat(chunks);
  const mime = res.ContentType || "image/jpeg";
  return { mime, data: buf.toString("base64") };
}

async function embedImage(mime, data) {
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
    config: { outputDimensionality: dims },
  });
  const values = response.embeddings?.[0]?.values;
  if (!values?.length) throw new Error("embedding vazio");
  if (values.length !== dims) {
    throw new Error(`embedding com ${values.length} dims (esperado ${dims})`);
  }
  return values;
}

try {
  const items = await sql`
    SELECT c.id, c.label, m.bucket, m.object_key
    FROM catalog_items c
    JOIN media_assets m ON m.id = c.image_asset_id
    WHERE c.client_id = ${clientId}
      AND c.is_reference = true
      AND c.enrichment_status = 'ready'
      AND c.image_asset_id IS NOT NULL
      AND c.image_embedding IS NULL
    ORDER BY c.created_at DESC
  `;

  console.info(`Backfill embeddings: ${items.length} itens para ${clientId}`);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    process.stdout.write(`[${i + 1}/${items.length}] ${item.label} … `);
    try {
      const { mime, data } = await loadImageFromMinio(item.bucket, item.object_key);
      const vector = await embedImage(mime, data);
      const lit = vectorLiteral(vector);
      await sql.unsafe(`
        UPDATE catalog_items
        SET image_embedding = '${lit}'::vector,
            embedding_model = '${model}',
            embedded_at = NOW(),
            updated_at = NOW()
        WHERE client_id = '${clientId.replace(/'/g, "''")}' AND id = '${item.id.replace(/'/g, "''")}'
      `);
      console.info("ok");
    } catch (err) {
      console.info("erro:", err instanceof Error ? err.message : err);
    }
    await new Promise((r) => setTimeout(r, 400));
  }
} finally {
  await sql.end({ timeout: 5 });
}
