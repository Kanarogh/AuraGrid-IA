import {
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createHash } from "crypto";
import {
  getMediaStorageProvider,
  isSquareBlobConfigured,
  SQUARE_BLOB_BUCKET,
} from "../config/mediaStorage";
import {
  MINIO_ACCESS_KEY,
  MINIO_BUCKET,
  MINIO_ENDPOINT,
  MINIO_PORT,
  MINIO_SECRET_KEY,
  MINIO_USE_SSL,
} from "../config/env";
import { getDb, isDatabaseConfigured } from "../db/client";
import { mediaAssets } from "../db/schema";
import {
  checkSquareBlobConnection,
  downloadSquareBlobObject,
  uploadSquareBlobObject,
} from "./squareBlobStorage";

let s3: S3Client | null = null;

/** @deprecated use isMediaStorageConfigured */
export function isMinioConfigured(): boolean {
  return isMediaStorageConfigured() && getMediaStorageProvider() === "minio";
}

export function isMediaStorageConfigured(): boolean {
  if (getMediaStorageProvider() === "squareblob") {
    return isSquareBlobConfigured();
  }
  return !!MINIO_ACCESS_KEY && !!MINIO_SECRET_KEY && !!MINIO_BUCKET;
}

function getS3(): S3Client {
  if (!s3) {
    s3 = new S3Client({
      region: "us-east-1",
      endpoint: `${MINIO_USE_SSL ? "https" : "http"}://${MINIO_ENDPOINT}:${MINIO_PORT}`,
      forcePathStyle: true,
      credentials: {
        accessKeyId: MINIO_ACCESS_KEY,
        secretAccessKey: MINIO_SECRET_KEY,
      },
    });
  }
  return s3;
}

export async function checkMinioConnection(): Promise<boolean> {
  if (getMediaStorageProvider() === "squareblob") {
    return checkSquareBlobConnection();
  }
  if (!isMediaStorageConfigured()) return false;
  try {
    await getS3().send(new HeadBucketCommand({ Bucket: MINIO_BUCKET }));
    return true;
  } catch {
    return false;
  }
}

export function buildObjectKey(
  clientId: string,
  kind: "catalog" | "canva" | "posts" | "media",
  fileName: string
): string {
  return `clients/${clientId}/${kind}/${fileName}`;
}

export async function uploadMediaBuffer(input: {
  clientId: string;
  userId: string;
  buffer: Buffer;
  mimeType: string;
  kind: "catalog" | "canva" | "posts" | "media";
  fileName: string;
  width?: number;
  height?: number;
}): Promise<{ id: string; objectKey: string; url: string }> {
  if (!isDatabaseConfigured()) throw new Error("DATABASE_URL não configurada.");
  if (!isMediaStorageConfigured()) {
    throw new Error(
      "Armazenamento de mídia não configurado. Use SQUARECLOUD_BLOB_API_KEY ou MINIO_*."
    );
  }

  const sha256 = createHash("sha256").update(input.buffer).digest("hex");
  const provider = getMediaStorageProvider();

  let bucket: string;
  let objectKey: string;
  let byteSize = input.buffer.byteLength;

  if (provider === "squareblob") {
    const blob = await uploadSquareBlobObject({
      clientId: input.clientId,
      buffer: input.buffer,
      mimeType: input.mimeType,
      fileName: input.fileName,
    });
    bucket = SQUARE_BLOB_BUCKET;
    objectKey = blob.blobId;
    byteSize = blob.byteSize;
  } else {
    objectKey = buildObjectKey(input.clientId, input.kind, input.fileName);
    bucket = MINIO_BUCKET;
    await getS3().send(
      new PutObjectCommand({
        Bucket: MINIO_BUCKET,
        Key: objectKey,
        Body: input.buffer,
        ContentType: input.mimeType,
      })
    );
  }

  const db = getDb();
  const [row] = await db
    .insert(mediaAssets)
    .values({
      clientId: input.clientId,
      uploadedBy: input.userId,
      bucket,
      objectKey,
      mimeType: input.mimeType,
      byteSize,
      width: input.width,
      height: input.height,
      sha256,
    })
    .returning();

  return {
    id: row!.id,
    objectKey,
    url: `/api/v1/media/${row!.id}`,
  };
}

export async function getMediaBuffer(assetId: string): Promise<{
  buffer: Buffer;
  mimeType: string;
  clientId: string;
}> {
  const db = getDb();
  const { eq } = await import("drizzle-orm");
  const [row] = await db
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.id, assetId))
    .limit(1);
  if (!row) throw new Error("Mídia não encontrada.");

  if (row.bucket === SQUARE_BLOB_BUCKET) {
    return {
      buffer: await downloadSquareBlobObject(row.objectKey),
      mimeType: row.mimeType,
      clientId: row.clientId,
    };
  }

  const response = await getS3().send(
    new GetObjectCommand({ Bucket: row.bucket, Key: row.objectKey })
  );
  const bytes = await response.Body?.transformToByteArray();
  if (!bytes) throw new Error("Arquivo vazio.");

  return {
    buffer: Buffer.from(bytes),
    mimeType: row.mimeType,
    clientId: row.clientId,
  };
}

export async function mediaAssetToDataUrl(assetId: string): Promise<string> {
  const { buffer, mimeType } = await getMediaBuffer(assetId);
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

export function mediaPublicUrl(assetId: string): string {
  return `/api/v1/media/${assetId}`;
}
