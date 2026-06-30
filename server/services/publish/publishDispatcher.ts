import type { PublishPlatform } from "../../../src/lib/publish/platforms";
import { isPublishPlatform } from "../../../src/lib/publish/platforms";
import {
  markJobFailed,
  markJobPublished,
  type PublishJobRow,
} from "../publishJobService";
import {
  handleFacebookError,
  translateFacebookError,
} from "./metaFacebookPageProvider";
import {
  handleInstagramError,
  translateInstagramError,
} from "./metaInstagramProvider";
import {
  handleLinkedInError,
  translateLinkedInPublishError,
} from "./linkedinProvider";
import {
  handlePinterestError,
  translatePinterestPublishError,
} from "./pinterestProvider";
import { getPublishProvider } from "./publishProviderRegistry";

function translateError(platform: PublishPlatform, raw: string): string {
  switch (platform) {
    case "instagram":
      return translateInstagramError(raw);
    case "facebook":
      return translateFacebookError(raw);
    case "linkedin":
      return translateLinkedInPublishError(raw);
    case "pinterest":
      return translatePinterestPublishError(raw);
    default:
      return raw;
  }
}

async function handleConnectionError(
  platform: PublishPlatform,
  clientId: string,
  raw: string
): Promise<void> {
  switch (platform) {
    case "instagram":
      await handleInstagramError(clientId, raw);
      break;
    case "facebook":
      await handleFacebookError(clientId, raw);
      break;
    case "linkedin":
      await handleLinkedInError(clientId, raw);
      break;
    case "pinterest":
      await handlePinterestError(clientId, raw);
      break;
  }
}

export async function dispatchPublishJob(job: PublishJobRow): Promise<void> {
  const platform = isPublishPlatform(job.platform) ? job.platform : "instagram";
  const provider = getPublishProvider(platform);
  const attempts = (job.attempts ?? 0) + 1;

  if (!provider) {
    await markJobFailed(job.id, `Plataforma não suportada: ${platform}`, attempts);
    return;
  }

  try {
    const publishedCount = await provider.countPublishedLast24h(job.clientId);
    if (publishedCount >= provider.maxPublishPer24h) {
      throw new Error(
        `Limite de ${provider.maxPublishPer24h} publicações por 24h atingido em ${platform}.`
      );
    }

    const result = await provider.execute(job);
    await markJobPublished(job.id, result.externalMediaId, result.permalink);
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    const friendly = translateError(platform, raw);
    await handleConnectionError(platform, job.clientId, raw);
    await markJobFailed(job.id, friendly, attempts);
  }
}
