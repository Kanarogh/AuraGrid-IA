import { META_PUBLISH_MOCK } from "../config/metaEnv";
import {
  createMediaContainer,
  getContainerStatus,
  publishMediaContainer,
  translateMetaError,
} from "./metaGraphClient";
import { getMetaConnectionWithToken, markMetaConnectionExpired } from "./metaConnectionService";
import { getPublicMediaUrlForMeta } from "./mediaPublishUrl";
import {
  countPublishedLast24h,
  markJobFailed,
  markJobPublished,
  updateJobMetaContainer,
  type PublishJobRow,
} from "./publishJobService";

const MAX_PUBLISH_PER_24H = 100;
const POLL_INTERVAL_MS = 3000;
const POLL_MAX_MS = 5 * 60 * 1000;

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function waitForContainer(containerId: string, accessToken: string): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < POLL_MAX_MS) {
    const status = await getContainerStatus(containerId, accessToken);
    if (status === "FINISHED") return;
    if (status === "ERROR" || status === "EXPIRED") {
      throw new Error(`Container Meta: ${status}`);
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error("Tempo esgotado aguardando processamento da imagem na rede social.");
}

export async function executePublishJob(job: PublishJobRow): Promise<void> {
  const attempts = (job.attempts ?? 0) + 1;

  try {
    const publishedCount = await countPublishedLast24h(job.clientId);
    if (publishedCount >= MAX_PUBLISH_PER_24H) {
      throw new Error("Limite de 100 publicações por 24h atingido nesta conta.");
    }

    if (META_PUBLISH_MOCK) {
      await sleep(500);
      await markJobPublished(
        job.id,
        `mock_${job.id.slice(0, 8)}`,
        `https://instagram.com/p/mock_${job.plannedPostId}`
      );
      return;
    }

    const connection = await getMetaConnectionWithToken(job.clientId);
    if (!connection?.igUserId) {
      throw new Error("Nenhuma rede social conectada. Reconecte em Programar posts.");
    }

    const imageUrl = await getPublicMediaUrlForMeta(job.imageAssetId);
    const containerId = await createMediaContainer({
      igUserId: connection.igUserId,
      accessToken: connection.accessToken,
      imageUrl,
      caption: job.caption,
    });
    await updateJobMetaContainer(job.id, containerId);
    await waitForContainer(containerId, connection.accessToken);
    const published = await publishMediaContainer({
      igUserId: connection.igUserId,
      accessToken: connection.accessToken,
      containerId,
    });
    await markJobPublished(job.id, published.id, published.permalink ?? null);
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    const friendly = translateMetaError(raw);
    if (/expirou|expired|oauth|190/i.test(raw)) {
      await markMetaConnectionExpired(job.clientId);
    }
    await markJobFailed(job.id, friendly, attempts);
  }
}
