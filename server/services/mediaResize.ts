import sharp from "sharp";

const MIN_WIDTH = 64;
const MAX_WIDTH = 2048;

export async function resizeMediaBuffer(
  buffer: Buffer,
  mimeType: string,
  requestedWidth: number
): Promise<{ buffer: Buffer; mimeType: string }> {
  const width = Math.min(Math.max(requestedWidth, MIN_WIDTH), MAX_WIDTH);
  const pipeline = sharp(buffer, { failOn: "none" }).rotate().resize({
    width,
    withoutEnlargement: true,
  });

  const keepAlpha = mimeType === "image/png" || mimeType === "image/webp";
  if (keepAlpha) {
    return {
      buffer: await pipeline.png({ compressionLevel: 8 }).toBuffer(),
      mimeType: "image/png",
    };
  }

  return {
    buffer: await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer(),
    mimeType: "image/jpeg",
  };
}
