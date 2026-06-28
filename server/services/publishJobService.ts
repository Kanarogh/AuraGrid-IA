import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "../db/client";
import { instagramPublishJobs, plannedPosts, planningPeriods } from "../db/schema";
import { HttpError } from "../http/respond";
import { suggestScheduleTimes } from "../../src/lib/publish/suggestScheduleTimes";
import { getClientPublishPrefs } from "./publishPrefsService";
import { mediaPublicUrl } from "./mediaService";
import type { CreateJobsPayload } from "../validation/publishSchema";

export type PublishJobRow = typeof instagramPublishJobs.$inferSelect;

export type PublishQueueItem = {
  jobId: string | null;
  plannedPostId: string;
  dayNumber: number;
  dateLabel: string;
  caption: string;
  imageAssetId: string | null;
  imageUrl: string | null;
  isConfirmed: boolean;
  scheduledAt: string | null;
  status:
    | "eligible"
    | "queued"
    | "publishing"
    | "published"
    | "failed"
    | "cancelled";
  permalink: string | null;
  lastError: string | null;
  attempts: number;
};

function mapJobStatus(status: string): PublishQueueItem["status"] {
  if (status === "queued") return "queued";
  if (status === "publishing") return "publishing";
  if (status === "published") return "published";
  if (status === "failed") return "failed";
  if (status === "cancelled") return "cancelled";
  return "eligible";
}

export async function listPublishQueue(
  clientId: string,
  planningPeriodId: string
): Promise<PublishQueueItem[]> {
  if (!isDatabaseConfigured()) return [];
  const db = getDb();

  const posts = await db
    .select()
    .from(plannedPosts)
    .where(
      and(
        eq(plannedPosts.clientId, clientId),
        eq(plannedPosts.planningPeriodId, planningPeriodId)
      )
    )
    .orderBy(asc(plannedPosts.dayNumber), asc(plannedPosts.id));

  const jobs = await db
    .select()
    .from(instagramPublishJobs)
    .where(
      and(
        eq(instagramPublishJobs.clientId, clientId),
        eq(instagramPublishJobs.planningPeriodId, planningPeriodId)
      )
    );

  const jobByPost = new Map(jobs.map((j) => [j.plannedPostId, j]));

  return posts.map((post) => {
    const job = jobByPost.get(post.id);
    const hasAsset = !!post.imageAssetId;
    const hasCaption = !!post.caption?.trim();
    const eligible =
      post.isConfirmed && hasAsset && hasCaption && !job;

    let status: PublishQueueItem["status"] = "eligible";
    if (job) status = mapJobStatus(job.status);
    else if (!post.isConfirmed || !hasAsset || !hasCaption) status = "eligible";

    return {
      jobId: job?.id ?? null,
      plannedPostId: post.id,
      dayNumber: post.dayNumber,
      dateLabel: post.dateLabel,
      caption: job?.caption ?? post.caption ?? "",
      imageAssetId: job?.imageAssetId ?? post.imageAssetId,
      imageUrl: (job?.imageAssetId ?? post.imageAssetId)
        ? mediaPublicUrl(job?.imageAssetId ?? post.imageAssetId!)
        : null,
      isConfirmed: post.isConfirmed,
      scheduledAt: job?.scheduledAt?.toISOString() ?? null,
      status: job ? status : eligible ? "eligible" : "eligible",
      permalink: job?.permalink ?? null,
      lastError: job?.lastError ?? null,
      attempts: job?.attempts ?? 0,
    };
  });
}

export async function previewScheduleTimes(
  clientId: string,
  planningPeriodId: string,
  postIds?: string[]
): Promise<
  Array<{
    postId: string;
    dayNumber: number;
    scheduledAt: string;
    timeLabel: string;
    dateLabel: string;
  }>
> {
  const db = getDb();
  const [period] = await db
    .select({ startDate: planningPeriods.startDate })
    .from(planningPeriods)
    .where(eq(planningPeriods.id, planningPeriodId))
    .limit(1);
  if (!period) throw new HttpError(404, "Período não encontrado.");

  const prefs = await getClientPublishPrefs(clientId);
  const queue = await listPublishQueue(clientId, planningPeriodId);
  const eligible = queue.filter(
    (q) =>
      q.isConfirmed &&
      q.imageAssetId &&
      q.caption.trim() &&
      (!q.jobId || q.status === "failed" || q.status === "cancelled") &&
      (!postIds?.length || postIds.includes(q.plannedPostId))
  );

  return suggestScheduleTimes({
    startDate: String(period.startDate),
    timezone: prefs.timezone,
    slotTemplates: prefs.slotTemplates,
    posts: eligible.map((e) => ({
      postId: e.plannedPostId,
      dayNumber: e.dayNumber,
      dateLabel: e.dateLabel,
    })),
  });
}

export async function createPublishJobs(
  clientId: string,
  userId: string,
  payload: CreateJobsPayload
): Promise<PublishJobRow[]> {
  const db = getDb();
  const prefs = await getClientPublishPrefs(clientId);
  const minTime = Date.now() + prefs.defaultLeadMinutes * 60_000;

  const created: PublishJobRow[] = [];
  for (const job of payload.jobs) {
    const scheduled = new Date(job.scheduledAt);
    if (scheduled.getTime() < minTime) {
      throw new HttpError(
        400,
        `Horário deve ser pelo menos ${prefs.defaultLeadMinutes} minutos no futuro.`
      );
    }
    if (!job.caption.trim()) throw new HttpError(400, "Legenda vazia.");
    if (job.caption.length > 2200) throw new HttpError(400, "Legenda longa demais (máx. 2200).");

    const [row] = await db
      .insert(instagramPublishJobs)
      .values({
        clientId,
        planningPeriodId: payload.planningPeriodId,
        plannedPostId: job.plannedPostId,
        createdByUserId: userId,
        scheduledAt: scheduled,
        caption: job.caption,
        imageAssetId: job.imageAssetId,
        status: "queued",
      })
      .returning();
    if (row) created.push(row);
  }
  return created;
}

export async function patchPublishJob(
  clientId: string,
  jobId: string,
  patch: { scheduledAt?: string; status?: "cancelled" }
): Promise<PublishJobRow> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(instagramPublishJobs)
    .where(and(eq(instagramPublishJobs.id, jobId), eq(instagramPublishJobs.clientId, clientId)))
    .limit(1);
  if (!existing) throw new HttpError(404, "Agendamento não encontrado.");
  if (existing.status === "published") {
    throw new HttpError(400, "Post já publicado — não pode ser alterado.");
  }

  const [row] = await db
    .update(instagramPublishJobs)
    .set({
      scheduledAt: patch.scheduledAt ? new Date(patch.scheduledAt) : existing.scheduledAt,
      status: patch.status ?? existing.status,
      updatedAt: new Date(),
      ...(patch.status === "cancelled"
        ? { lastError: null }
        : {}),
    })
    .where(eq(instagramPublishJobs.id, jobId))
    .returning();
  return row!;
}

export async function retryPublishJob(clientId: string, jobId: string): Promise<PublishJobRow> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(instagramPublishJobs)
    .where(and(eq(instagramPublishJobs.id, jobId), eq(instagramPublishJobs.clientId, clientId)))
    .limit(1);
  if (!existing) throw new HttpError(404, "Agendamento não encontrado.");
  if (existing.status !== "failed") {
    throw new HttpError(400, "Só é possível tentar de novo em posts com problema.");
  }

  const [row] = await db
    .update(instagramPublishJobs)
    .set({
      status: "queued",
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(instagramPublishJobs.id, jobId))
    .returning();
  return row!;
}

export async function claimDuePublishJobs(limit = 10): Promise<PublishJobRow[]> {
  if (!isDatabaseConfigured()) return [];
  const db = getDb();
  const now = new Date();

  const due = await db
    .select()
    .from(instagramPublishJobs)
    .where(and(eq(instagramPublishJobs.status, "queued"), lte(instagramPublishJobs.scheduledAt, now)))
    .orderBy(asc(instagramPublishJobs.scheduledAt))
    .limit(limit);

  const claimed: PublishJobRow[] = [];
  for (const job of due) {
    const [updated] = await db
      .update(instagramPublishJobs)
      .set({ status: "publishing", updatedAt: new Date() })
      .where(
        and(eq(instagramPublishJobs.id, job.id), eq(instagramPublishJobs.status, "queued"))
      )
      .returning();
    if (updated) claimed.push(updated);
  }
  return claimed;
}

export async function markJobPublished(
  jobId: string,
  metaMediaId: string,
  permalink: string | null
): Promise<void> {
  const db = getDb();
  await db
    .update(instagramPublishJobs)
    .set({
      status: "published",
      metaMediaId,
      permalink,
      publishedAt: new Date(),
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(instagramPublishJobs.id, jobId));
}

export async function markJobFailed(jobId: string, error: string, attempts: number): Promise<void> {
  const db = getDb();
  await db
    .update(instagramPublishJobs)
    .set({
      status: attempts >= 3 ? "failed" : "queued",
      lastError: error,
      attempts,
      updatedAt: new Date(),
    })
    .where(eq(instagramPublishJobs.id, jobId));
}

export async function countPublishedLast24h(clientId: string): Promise<number> {
  const db = getDb();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(instagramPublishJobs)
    .where(
      and(
        eq(instagramPublishJobs.clientId, clientId),
        eq(instagramPublishJobs.status, "published"),
        gte(instagramPublishJobs.publishedAt, since)
      )
    );
  return row?.count ?? 0;
}

export async function updateJobMetaContainer(jobId: string, containerId: string): Promise<void> {
  const db = getDb();
  await db
    .update(instagramPublishJobs)
    .set({ metaContainerId: containerId, updatedAt: new Date() })
    .where(eq(instagramPublishJobs.id, jobId));
}

export async function resetStalePublishingJobs(): Promise<number> {
  if (!isDatabaseConfigured()) return 0;
  const db = getDb();
  const staleBefore = new Date(Date.now() - 15 * 60 * 1000);
  const rows = await db
    .update(instagramPublishJobs)
    .set({ status: "queued", updatedAt: new Date() })
    .where(
      and(
        eq(instagramPublishJobs.status, "publishing"),
        lte(instagramPublishJobs.updatedAt, staleBefore)
      )
    )
    .returning({ id: instagramPublishJobs.id });
  return rows.length;
}
