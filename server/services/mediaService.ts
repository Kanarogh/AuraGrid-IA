import {
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createHash } from "crypto";
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

let s3: S3Client | null = null;

export function isMinioConfigured(): boolean {
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
  if (!isMinioConfigured()) return false;
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
  if (!isMinioConfigured()) throw new Error("MinIO não configurado.");

  const objectKey = buildObjectKey(input.clientId, input.kind, input.fileName);
  const sha256 = createHash("sha256").update(input.buffer).digest("hex");

  await getS3().send(
    new PutObjectCommand({
      Bucket: MINIO_BUCKET,
      Key: objectKey,
      Body: input.buffer,
      ContentType: input.mimeType,
    })
  );

  const db = getDb();
  const [row] = await db
    .insert(mediaAssets)
    .values({
      clientId: input.clientId,
      uploadedBy: input.userId,
      bucket: MINIO_BUCKET,
      objectKey,
      mimeType: input.mimeType,
      byteSize: input.buffer.byteLength,
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
