import { envInt, envString } from "./env";

export type MediaStorageProvider = "minio" | "squareblob";

export const SQUARE_BLOB_BUCKET = "squareblob";
export const SQUARE_BLOB_PUBLIC_BASE =
  envString("SQUARECLOUD_BLOB_PUBLIC_BASE", "https://public-blob.squarecloud.dev").replace(
    /\/$/,
    ""
  );
export const SQUARE_BLOB_EXPIRE_DAYS = envInt("SQUARECLOUD_BLOB_EXPIRE_DAYS", 365);

export function getSquareBlobApiKey(): string {
  return (
    envString("SQUARECLOUD_BLOB_API_KEY") ||
    envString("SQUARE_BLOB_API_KEY") ||
    envString("SQUARECLOUD_API_KEY")
  );
}

export function getMediaStorageProvider(): MediaStorageProvider {
  const explicit = envString("MEDIA_STORAGE").toLowerCase();
  if (explicit === "squareblob" || explicit === "blob") return "squareblob";
  if (explicit === "minio" || explicit === "s3") return "minio";
  if (getSquareBlobApiKey()) return "squareblob";
  return "minio";
}

export function isSquareBlobConfigured(): boolean {
  return !!getSquareBlobApiKey();
}
