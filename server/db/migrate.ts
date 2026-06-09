import fs from "fs/promises";
import path from "path";
import postgres from "postgres";
import { envString } from "../config/env";

const MIGRATION_FILES = ["0000_initial", "0001_campaign_context", "0002_planned_posts_multi"] as const;

export async function runMigrations(): Promise<void> {
  const url = envString("DATABASE_URL");
  if (!url) {
    console.warn("[AuraGrid] DATABASE_URL não definida — migrations ignoradas.");
    return;
  }

  const sql = postgres(url, { max: 1 });
  try {
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL UNIQUE,
        created_at timestamptz DEFAULT now() NOT NULL
      );
    `);

    for (const hash of MIGRATION_FILES) {
      const existing = await sql<{ hash: string }[]>`
        SELECT hash FROM "__drizzle_migrations" WHERE hash = ${hash} LIMIT 1
      `;
      if (existing.length > 0) continue;

      const migrationPath = path.join(
        process.cwd(),
        `server/db/migrations/${hash}.sql`
      );
      const migrationSql = await fs.readFile(migrationPath, "utf-8");
      await sql.unsafe(migrationSql);
      await sql`INSERT INTO "__drizzle_migrations" (hash) VALUES (${hash})`;
      console.info(`[AuraGrid] Migration ${hash} aplicada.`);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

const isMain =
  process.argv[1]?.replace(/\\/g, "/").endsWith("server/db/migrate.ts") ||
  process.argv[1]?.replace(/\\/g, "/").endsWith("server/db/migrate.js");

if (isMain) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
