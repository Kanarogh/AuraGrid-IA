import sharp from "sharp";
import { cleanBase64 } from "./shared";

/** Reduz imagens de visão no servidor (Groq tem limite ~30k tokens por request). */
export async function shrinkVisionImage(
  dataUrl: string,
  options: { maxSide: number; quality: number }
): Promise<string> {
  if (!dataUrl?.startsWith("data:")) return dataUrl;

  const { maxSide, quality } = options;
  const { data } = cleanBase64(dataUrl);
  if (!data) return dataUrl;

  try {
    const input = Buffer.from(data, "base64");
    const meta = await sharp(input).metadata();
    const width = meta.width ?? maxSide;
    const height = meta.height ?? maxSide;
    const longest = Math.max(width, height);

    if (
      longest <= maxSide &&
      dataUrl.startsWith("data:image/jpeg") &&
      input.byteLength < 280_000
    ) {
      return dataUrl;
    }

    const output = await sharp(input)
      .rotate()
      .resize({
        width: width >= height ? maxSide : undefined,
        height: height > width ? maxSide : undefined,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({
        quality: Math.min(92, Math.max(55, Math.round(quality * 100))),
        mozjpeg: true,
      })
      .toBuffer();

    return `data:image/jpeg;base64,${output.toString("base64")}`;
  } catch (error) {
    console.warn("shrinkVisionImage failed, using original:", error);
    return dataUrl;
  }
}
