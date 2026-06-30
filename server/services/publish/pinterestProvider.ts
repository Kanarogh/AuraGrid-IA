import { META_PUBLISH_MOCK } from "../../config/metaEnv";
import { getPublicMediaUrlForMeta } from "../mediaPublishUrl";
import {
  createPinterestPin,
  refreshPinterestToken,
  translatePinterestError,
} from "../pinterestGraphClient";
import { countPublishedLast24hForPlatform } from "../publishJobService";
import type { PublishJobRow } from "../publishJobService";
import { getClientPublishPrefs } from "../publishPrefsService";
import {
  getSocialConnectionWithToken,
  markSocialConnectionExpired,
  updateSocialConnectionTokens,
} from "../socialConnectionService";
import type { PublishProvider } from "./types";

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function resolvePinterestToken(clientId: string) {
  const connection = await getSocialConnectionWithToken(clientId, "pinterest");
  if (!connection) {
    throw new Error("Pinterest não conectado. Conecte em Programar posts.");
  }

  let accessToken = connection.accessToken;
  const expiresAt = connection.tokenExpiresAt
    ? new Date(connection.tokenExpiresAt).getTime()
    : null;
  const needsRefresh =
    expiresAt != null && expiresAt - Date.now() < 5 * 60 * 1000 && connection.refreshToken;

  if (needsRefresh && connection.refreshToken) {
    const refreshed = await refreshPinterestToken(connection.refreshToken);
    accessToken = refreshed.access_token;
    await updateSocialConnectionTokens(
      clientId,
      "pinterest",
      refreshed.access_token,
      refreshed.refresh_token,
      new Date(Date.now() + refreshed.expires_in * 1000)
    );
  }

  const prefs = await getClientPublishPrefs(clientId);
  const boardId =
    prefs.pinterestDefaultBoardId ??
    (connection.metadata.defaultBoardId as string | undefined) ??
    null;
  if (!boardId) {
    throw new Error("Selecione um board padrão do Pinterest nas preferências.");
  }

  return { accessToken, boardId };
}

export const pinterestProvider: PublishProvider = {
  platform: "pinterest",
  maxPublishPer24h: 50,

  async countPublishedLast24h(clientId: string): Promise<number> {
    return countPublishedLast24hForPlatform(clientId, "pinterest");
  },

  async execute(job: PublishJobRow) {
    if (META_PUBLISH_MOCK) {
      await sleep(400);
      return {
        externalMediaId: `mock_pin_${job.id.slice(0, 8)}`,
        permalink: `https://pinterest.com/pin/mock_${job.plannedPostId}`,
      };
    }

    const { accessToken, boardId } = await resolvePinterestToken(job.clientId);
    const imageUrl = await getPublicMediaUrlForMeta(job.imageAssetId);
    const title = job.caption.split("\n")[0]?.slice(0, 100) || "Post";
    const published = await createPinterestPin({
      accessToken,
      boardId,
      imageUrl,
      title,
      description: job.caption,
    });
    return { externalMediaId: published.id, permalink: published.permalink };
  },
};

export async function handlePinterestError(clientId: string, raw: string): Promise<void> {
  if (/expired|invalid.*token|401|unauthorized|oauth/i.test(raw)) {
    await markSocialConnectionExpired(clientId, "pinterest");
  }
}

export function translatePinterestPublishError(message: string): string {
  return translatePinterestError(message);
}
