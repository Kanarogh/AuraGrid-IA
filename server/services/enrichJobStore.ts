import { eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "../db/client";
import { enrichJobs } from "../db/schema";
import type { EnrichProgress } from "./enrichQueue";

export type EnrichJobStatus = "idle" | "running" | "cancelled" | "completed";

export async function upsertEnrichJob(
  clientId: string,
  data: {
    userId?: string;
    itemIds?: string[];
    status: EnrichJobStatus;
    progress?: EnrichProgress | null;
  }
): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const db = getDb();
  await db
    .insert(enrichJobs)
    .values({
      clientId,
      userId: data.userId ?? null,
      itemIds: data.itemIds ?? null,
      status: data.status,
      progress: data.progress ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: enrichJobs.clientId,
      set: {
        userId: data.userId ?? undefined,
        itemIds: data.itemIds ?? undefined,
        status: data.status,
        progress: data.progress ?? null,
        updatedAt: new Date(),
      },
    });
}

export async function getPersistedEnrichProgress(
  clientId: string
): Promise<EnrichProgress | null> {
  if (!isDatabaseConfigured()) return null;
  const db = getDb();
  const [row] = await db
    .select({ progress: enrichJobs.progress, status: enrichJobs.status })
    .from(enrichJobs)
    .where(eq(enrichJobs.clientId, clientId))
    .limit(1);
  if (!row || row.status !== "running") return null;
  const progress = row.progress;
  if (!progress || typeof progress !== "object") return null;
  return progress as EnrichProgress;
}

export async function clearEnrichJob(clientId: string): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const db = getDb();
  await db.delete(enrichJobs).where(eq(enrichJobs.clientId, clientId));
}

/** Jobs "running" órfãos após restart — marca como idle. */
export async function resetStaleEnrichJobs(): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const db = getDb();
  await db
    .update(enrichJobs)
    .set({ status: "idle", progress: null, updatedAt: new Date() })
    .where(eq(enrichJobs.status, "running"));
}

export async function isPersistedEnrichmentRunning(clientId: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  const db = getDb();
  const [row] = await db
    .select({ status: enrichJobs.status })
    .from(enrichJobs)
    .where(eq(enrichJobs.clientId, clientId))
    .limit(1);
  return row?.status === "running";
}
