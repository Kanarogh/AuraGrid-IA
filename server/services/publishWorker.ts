import { claimDuePublishJobs, resetStalePublishingJobs } from "./publishJobService";
import { dispatchPublishJob } from "./publish/publishDispatcher";
import { refreshExpiringSocialTokens } from "./socialTokenRefreshService";
import { isDatabaseConfigured } from "../db/client";

let workerTimer: ReturnType<typeof setInterval> | null = null;
let running = false;

async function tick(): Promise<void> {
  if (!isDatabaseConfigured() || running) return;
  running = true;
  try {
    await refreshExpiringSocialTokens();
    await resetStalePublishingJobs();
    const jobs = await claimDuePublishJobs(5);
    for (const job of jobs) {
      await dispatchPublishJob(job);
    }
  } catch (err) {
    console.error("[publish-worker]", err instanceof Error ? err.message : err);
  } finally {
    running = false;
  }
}

export function startPublishWorker(): void {
  if (workerTimer) return;
  if (!isDatabaseConfigured()) return;
  void tick();
  workerTimer = setInterval(() => void tick(), 60_000);
  console.info("[AuraStudio] Publish worker iniciado (intervalo 60s).");
}

export function stopPublishWorker(): void {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }
}
