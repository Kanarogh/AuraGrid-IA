import { apiFetch, readApiJson } from "../api/apiClient";

export type MetaConnectionPublic = {
  connected: boolean;
  igUserId: string | null;
  igUsername: string | null;
  pageName: string | null;
  status: "active" | "expired" | "revoked" | "disconnected";
  tokenExpiresAt: string | null;
  connectedAt: string | null;
  needsReconnect: boolean;
};

export type PublishPrefs = {
  timezone: string;
  slotTemplates: Record<string, string[]>;
  defaultLeadMinutes: number;
};

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
  status: "eligible" | "not_ready" | "queued" | "publishing" | "published" | "failed" | "cancelled";
  permalink: string | null;
  lastError: string | null;
  attempts: number;
};

export type ScheduleSuggestion = {
  postId: string;
  dayNumber: number;
  scheduledAt: string;
  timeLabel: string;
  dateLabel: string;
};

export async function fetchMetaConnection(clientId: string): Promise<MetaConnectionPublic> {
  const res = await apiFetch(`/api/v1/clients/${encodeURIComponent(clientId)}/meta/connection`);
  return readApiJson(res);
}

export function startMetaOAuth(clientId: string): void {
  window.location.href = `/api/v1/clients/${encodeURIComponent(clientId)}/meta/oauth/start`;
}

export async function disconnectMeta(clientId: string): Promise<void> {
  const res = await apiFetch(`/api/v1/clients/${encodeURIComponent(clientId)}/meta/connection`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function fetchPublishPrefs(clientId: string): Promise<PublishPrefs> {
  const res = await apiFetch(`/api/v1/clients/${encodeURIComponent(clientId)}/publish/prefs`);
  return readApiJson(res);
}

export async function savePublishPrefs(clientId: string, prefs: PublishPrefs): Promise<PublishPrefs> {
  const res = await apiFetch(`/api/v1/clients/${encodeURIComponent(clientId)}/publish/prefs`, {
    method: "PUT",
    body: JSON.stringify(prefs),
  });
  return readApiJson(res);
}

export type PublishQueueSummary = {
  eligible: number;
  notReady: number;
  scheduled: number;
  published: number;
  failed: number;
  publishedLast24h: number;
  total: number;
};

export async function fetchPublishQueue(
  clientId: string,
  planningPeriodId: string
): Promise<{ queue: PublishQueueItem[]; summary: PublishQueueSummary }> {
  const qs = new URLSearchParams({ planningPeriodId });
  const res = await apiFetch(
    `/api/v1/clients/${encodeURIComponent(clientId)}/publish/jobs?${qs}`
  );
  const data = await readApiJson<{ queue: PublishQueueItem[]; summary: PublishQueueSummary }>(res);
  return { queue: data.queue, summary: data.summary };
}

export async function previewPublishSchedule(
  clientId: string,
  planningPeriodId: string,
  postIds?: string[]
): Promise<ScheduleSuggestion[]> {
  const res = await apiFetch(
    `/api/v1/clients/${encodeURIComponent(clientId)}/publish/jobs/preview`,
    {
      method: "POST",
      body: JSON.stringify({ planningPeriodId, postIds }),
    }
  );
  const data = await readApiJson<{ suggestions: ScheduleSuggestion[] }>(res);
  return data.suggestions;
}

export async function createPublishJobs(
  clientId: string,
  planningPeriodId: string,
  jobs: Array<{
    plannedPostId: string;
    scheduledAt: string;
    caption: string;
    imageAssetId: string;
  }>
): Promise<void> {
  const res = await apiFetch(`/api/v1/clients/${encodeURIComponent(clientId)}/publish/jobs`, {
    method: "POST",
    body: JSON.stringify({ planningPeriodId, jobs }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Falha ao programar posts.");
  }
}

export async function patchPublishJob(
  clientId: string,
  jobId: string,
  patch: { scheduledAt?: string; status?: "cancelled" }
): Promise<void> {
  const res = await apiFetch(
    `/api/v1/clients/${encodeURIComponent(clientId)}/publish/jobs/${encodeURIComponent(jobId)}`,
    { method: "PATCH", body: JSON.stringify(patch) }
  );
  if (!res.ok) throw new Error(await res.text());
}

export async function retryPublishJob(clientId: string, jobId: string): Promise<void> {
  const res = await apiFetch(
    `/api/v1/clients/${encodeURIComponent(clientId)}/publish/jobs/${encodeURIComponent(jobId)}/retry`,
    { method: "POST" }
  );
  if (!res.ok) throw new Error(await res.text());
}

export const PUBLISH_STATUS_LABELS: Record<PublishQueueItem["status"], string> = {
  eligible: "Pronto para programar",
  not_ready: "Incompleto",
  queued: "Agendado",
  publishing: "Publicando agora…",
  published: "No ar",
  failed: "Não publicou",
  cancelled: "Cancelado",
};
