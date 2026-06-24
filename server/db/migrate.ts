import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import postgres from "postgres";
import { envString } from "../config/env";
import { postgresConnectOptions } from "./postgresOptions";

const MIGRATION_FILES = [
  "0000_initial",
  "0001_campaign_context",
  "0002_planned_posts_multi",
  "0003_catalog_embeddings",
  "0004_user_ai_preferences_models",
  "0005_planning_periods",
  "0006_uses_references",
] as const;

async function waitForPostgres(url: string, attempts = 30, delayMs = 1000): Promise<void> {
  for (let i = 1; i <= attempts; i++) {
    const probe = postgres(url, postgresConnectOptions({ max: 1, connect_timeout: 3 }));
    try {
      await probe`SELECT 1`;
      await probe.end({ timeout: 2 });
      return;
    } catch (err) {
      await probe.end({ timeout: 2 }).catch(() => undefined);
      const starting =
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code?: string }).code === "57P03";
      if (!starting && i === attempts) throw err;
      if (i < attempts) {
        console.info(`[AuraGrid] Postgres indisponível (${i}/${attempts}) — aguardando…`);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
}

export async function runMigrations(): Promise<void> {
  const url = envString("DATABASE_URL");
  if (!url) {
    console.warn("[AuraGrid] DATABASE_URL não definida — migrations ignoradas.");
    return;
  }

  await waitForPostgres(url);

  const sql = postgres(url, postgresConnectOptions({ max: 1 }));
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
