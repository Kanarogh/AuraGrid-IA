import { uploadMediaApi, resolveMediaUrl } from "./workspaceApi";

const MEDIA_PATH_RE = /\/api\/v1\/media\/([0-9a-f-]{36})/i;

export function extractMediaAssetId(image: string | null | undefined): string | null {
  if (!image) return null;
  const match = image.match(MEDIA_PATH_RE);
  return match ? match[1] : null;
}

export async function ensurePersistedImage(
  clientId: string,
  image: string | null | undefined,
  kind: "canva" | "posts",
  existingAssetId?: string | null
): Promise<{ image: string | null; imageAssetId: string | null }> {
  if (!image) return { image: null, imageAssetId: null };

  const fromUrl = extractMediaAssetId(image);
  if (fromUrl) {
    return { image: resolveMediaUrl(image) ?? image, imageAssetId: fromUrl };
  }

  if (existingAssetId) {
    const url = resolveMediaUrl(`/api/v1/media/${existingAssetId}`);
    return { image: url, imageAssetId: existingAssetId };
  }

  if (!image.startsWith("data:")) {
    return { image, imageAssetId: null };
  }

  const blob = await (await fetch(image)).blob();
  const media = await uploadMediaApi(clientId, blob, kind);
  const url = resolveMediaUrl(media.url) ?? `/api/v1/media/${media.id}`;
  return { image: url, imageAssetId: media.id };
}
