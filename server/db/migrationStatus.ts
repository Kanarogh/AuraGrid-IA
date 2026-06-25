import { getSqlClient, isDatabaseConfigured } from "./client";
import { MIGRATION_FILES, type MigrationHash } from "./migrationCatalog";

export type MigrationStatus = {
  expected: MigrationHash[];
  applied: MigrationHash[];
  pending: MigrationHash[];
  contentScheduleReady: boolean;
};

export async function getMigrationStatus(): Promise<MigrationStatus | null> {
  if (!isDatabaseConfigured()) return null;

  const sql = getSqlClient();
  const rows = await sql<{ hash: string }[]>`
    SELECT hash FROM "__drizzle_migrations" ORDER BY id ASC
  `;
  const appliedSet = new Set(rows.map((r) => r.hash));
  const expected = [...MIGRATION_FILES];
  const applied = expected.filter((h) => appliedSet.has(h));
  const pending = expected.filter((h) => !appliedSet.has(h));

  const [col] = await sql<{ column_name: string }[]>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'planning_periods'
      AND column_name = 'content_schedule'
    LIMIT 1
  `;

  return {
    expected,
    applied,
    pending,
    contentScheduleReady: pending.length === 0 && !!col?.column_name,
  };
}
