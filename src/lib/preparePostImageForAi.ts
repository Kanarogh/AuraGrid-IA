import { fetchImageAsDataUrl } from "./api/workspaceApi";
import { convertSvgToDataUrl, resizeForAi } from "./images";

/** Mesma pipeline usada em match-and-generate — chave de cache e payload à IA ficam alinhados. */
export async function preparePostImageForAi(
  imageSrc: string,
  options?: { maxSide?: number; quality?: number }
): Promise<string> {
  const resolved = imageSrc.startsWith("/api/")
    ? await fetchImageAsDataUrl(imageSrc)
    : imageSrc;
  const raw = await convertSvgToDataUrl(resolved);
  return resizeForAi(raw, {
    maxSide: options?.maxSide ?? 768,
    quality: options?.quality ?? 0.8,
  });
}
