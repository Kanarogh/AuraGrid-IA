import { sql as drizzleSql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let sqlClient: ReturnType<typeof postgres> | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function isDatabaseConfigured(): boolean {
  return !!process.env.DATABASE_URL?.trim();
}

export function getDb() {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL não configurada.");
  }
  if (!sqlClient || !db) {
    sqlClient = postgres(process.env.DATABASE_URL!.trim(), { max: 10 });
    db = drizzle(sqlClient, { schema });
  }
  return db;
}

/** Cliente postgres.js — use para pgvector (drizzle sql.raw falha em vetores grandes). */
export function getSqlClient() {
  getDb();
  return sqlClient!;
}

export async function checkDatabaseConnection(): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  try {
    const client = getDb();
    await client.execute(drizzleSql`SELECT 1`);
    return true;
  } catch {
    return false;
  }
}

export async function closeDatabase(): Promise<void> {
  if (sqlClient) {
    await sqlClient.end({ timeout: 5 });
    sqlClient = null;
    db = null;
  }
}

export type Database = ReturnType<typeof getDb>;
