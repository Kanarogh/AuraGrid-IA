import { META_PUBLISH_MOCK } from "../../config/metaEnv";
import { publishPagePhoto, translateMetaError } from "../metaGraphClient";
import { getMetaConnectionWithToken, markMetaConnectionExpired } from "../metaConnectionService";
import { getPublicMediaUrlForMeta } from "../mediaPublishUrl";
import { countPublishedLast24hForPlatform } from "../publishJobService";
import type { PublishJobRow } from "../publishJobService";
import type { PublishProvider } from "./types";

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

export const metaFacebookPageProvider: PublishProvider = {
  platform: "facebook",
  maxPublishPer24h: 100,

  async countPublishedLast24h(clientId: string): Promise<number> {
    return countPublishedLast24hForPlatform(clientId, "facebook");
  },

  async execute(job: PublishJobRow) {
    if (META_PUBLISH_MOCK) {
      await sleep(400);
      return {
        externalMediaId: `mock_fb_${job.id.slice(0, 8)}`,
        permalink: `https://facebook.com/mock_${job.plannedPostId}`,
      };
    }

    const connection = await getMetaConnectionWithToken(job.clientId);
    if (!connection?.facebookPageId) {
      throw new Error("Página do Facebook não conectada. Reconecte em Programar posts.");
    }

    const imageUrl = await getPublicMediaUrlForMeta(job.imageAssetId);
    const published = await publishPagePhoto({
      pageId: connection.facebookPageId,
      accessToken: connection.accessToken,
      imageUrl,
      caption: job.caption,
    });
    return { externalMediaId: published.id, permalink: published.permalink ?? null };
  },
};

export function translateFacebookError(message: string): string {
  return translateMetaError(message);
}

export async function handleFacebookError(clientId: string, raw: string): Promise<void> {
  if (/expirou|expired|oauth|190/i.test(raw)) {
    await markMetaConnectionExpired(clientId);
  }
}
