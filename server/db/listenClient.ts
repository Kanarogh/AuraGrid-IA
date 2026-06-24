import postgres from "postgres";
import { isDatabaseConfigured } from "./client";
import { postgresConnectOptions } from "./postgresOptions";

let listenSql: ReturnType<typeof postgres> | null = null;
let listenStarted = false;
let listenInit: Promise<void> | null = null;

export function getListenClient(): ReturnType<typeof postgres> | null {
  if (!isDatabaseConfigured()) return null;
  if (!listenSql) {
    listenSql = postgres(process.env.DATABASE_URL!.trim(), postgresConnectOptions({ max: 1 }));
  }
  return listenSql;
}

export async function ensureListenChannel(
  channel: string,
  onNotify: (payload: string) => void
): Promise<void> {
  const sql = getListenClient();
  if (!sql) return;
  if (listenStarted) return;
  if (!listenInit) {
    listenInit = sql.listen(channel, onNotify).then(() => {
      listenStarted = true;
    });
  }
  await listenInit;
}

export async function closeListenClient(): Promise<void> {
  if (listenSql) {
    await listenSql.end({ timeout: 5 });
    listenSql = null;
    listenStarted = false;
    listenInit = null;
  }
}
