import { getSqlClient, isDatabaseConfigured } from "./client";

let cached: boolean | null = null;

/** true se a coluna image_embedding (pgvector) existir no banco atual. */
export async function isPgvectorAvailable(): Promise<boolean> {
  if (cached !== null) return cached;
  if (!isDatabaseConfigured()) {
    cached = false;
    return false;
  }
  try {
    const sql = getSqlClient();
    const rows = await sql<{ ok: boolean }[]>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'catalog_items'
          AND column_name = 'image_embedding'
      ) AS ok
    `;
    cached = rows[0]?.ok === true;
  } catch {
    cached = false;
  }
  return cached;
}

export function resetPgvectorAvailabilityCache(): void {
  cached = null;
}
