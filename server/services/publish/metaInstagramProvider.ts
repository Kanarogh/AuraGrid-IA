import { META_PUBLISH_MOCK } from "../../config/metaEnv";
import {
  createMediaContainer,
  getContainerStatus,
  publishMediaContainer,
  translateMetaError,
} from "../metaGraphClient";
import { getMetaConnectionWithToken, markMetaConnectionExpired } from "../metaConnectionService";
import { getPublicMediaUrlForMeta } from "../mediaPublishUrl";
import {
  countPublishedLast24hForPlatform,
  updateJobMetaContainer,
} from "../publishJobService";
import type { PublishJobRow } from "../publishJobService";
import type { PublishProvider } from "./types";

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

export const metaInstagramProvider: PublishProvider = {
  platform: "instagram",
  maxPublishPer24h: 100,

  async countPublishedLast24h(clientId: string): Promise<number> {
    return countPublishedLast24hForPlatform(clientId, "instagram");
  },

  async execute(job: PublishJobRow) {
    if (META_PUBLISH_MOCK) {
      await sleep(500);
      return {
        externalMediaId: `mock_ig_${job.id.slice(0, 8)}`,
        permalink: `https://instagram.com/p/mock_${job.plannedPostId}`,
      };
    }

    const connection = await getMetaConnectionWithToken(job.clientId);
    if (!connection?.igUserId) {
      throw new Error("Instagram não conectado. Reconecte em Programar posts.");
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
    return { externalMediaId: published.id, permalink: published.permalink ?? null };
  },
};

export function translateInstagramError(message: string): string {
  return translateMetaError(message);
}

export async function handleInstagramError(clientId: string, raw: string): Promise<void> {
  if (/expirou|expired|oauth|190/i.test(raw)) {
    await markMetaConnectionExpired(clientId);
  }
}
