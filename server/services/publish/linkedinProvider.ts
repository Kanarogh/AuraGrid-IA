import { META_PUBLISH_MOCK } from "../../config/metaEnv";
import {
  publishLinkedInImagePost,
  refreshLinkedInToken,
  translateLinkedInError,
} from "../linkedinGraphClient";
import { getPublicMediaUrlForMeta } from "../mediaPublishUrl";
import { countPublishedLast24hForPlatform } from "../publishJobService";
import type { PublishJobRow } from "../publishJobService";
import {
  getSocialConnectionWithToken,
  markSocialConnectionExpired,
  updateSocialConnectionTokens,
} from "../socialConnectionService";
import type { PublishProvider } from "./types";

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function resolveLinkedInToken(clientId: string) {
  const connection = await getSocialConnectionWithToken(clientId, "linkedin");
  if (!connection) {
    throw new Error("LinkedIn não conectado. Conecte em Programar posts.");
  }

  let accessToken = connection.accessToken;
  const expiresAt = connection.tokenExpiresAt
    ? new Date(connection.tokenExpiresAt).getTime()
    : null;
  const needsRefresh =
    expiresAt != null && expiresAt - Date.now() < 5 * 60 * 1000 && connection.refreshToken;

  if (needsRefresh && connection.refreshToken) {
    const refreshed = await refreshLinkedInToken(connection.refreshToken);
    accessToken = refreshed.access_token;
    await updateSocialConnectionTokens(
      clientId,
      "linkedin",
      refreshed.access_token,
      refreshed.refresh_token ?? connection.refreshToken,
      new Date(Date.now() + refreshed.expires_in * 1000)
    );
  }

  const authorUrn =
    (connection.metadata.authorUrn as string) ??
    (connection.metadata.organizationUrn as string) ??
    null;
  if (!authorUrn) {
    throw new Error("Conta LinkedIn sem página/organização configurada. Reconecte.");
  }

  return { accessToken, authorUrn };
}

export const linkedinProvider: PublishProvider = {
  platform: "linkedin",
  maxPublishPer24h: 50,

  async countPublishedLast24h(clientId: string): Promise<number> {
    return countPublishedLast24hForPlatform(clientId, "linkedin");
  },

  async execute(job: PublishJobRow) {
    if (META_PUBLISH_MOCK) {
      await sleep(400);
      return {
        externalMediaId: `mock_li_${job.id.slice(0, 8)}`,
        permalink: `https://linkedin.com/feed/mock_${job.plannedPostId}`,
      };
    }

    const { accessToken, authorUrn } = await resolveLinkedInToken(job.clientId);
    const imageUrl = await getPublicMediaUrlForMeta(job.imageAssetId);
    const published = await publishLinkedInImagePost({
      accessToken,
      authorUrn,
      imageUrl,
      caption: job.caption,
    });
    return { externalMediaId: published.id, permalink: published.permalink };
  },
};

export async function handleLinkedInError(clientId: string, raw: string): Promise<void> {
  if (/expired|invalid.*token|401|oauth/i.test(raw)) {
    await markSocialConnectionExpired(clientId, "linkedin");
  }
}

export function translateLinkedInPublishError(message: string): string {
  return translateLinkedInError(message);
}
