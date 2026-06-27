import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import jwt from "jsonwebtoken";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  getMediaStorageProvider,
  isSquareBlobConfigured,
  SQUARE_BLOB_PUBLIC_BASE,
} from "../config/mediaStorage";
import { JWT_SECRET, MINIO_BUCKET } from "../config/env";
import { NEXT_PUBLIC_APP_URL } from "../config/metaEnv";
import { getDb } from "../db/client";
import { mediaAssets } from "../db/schema";
import { eq } from "drizzle-orm";
import { getMediaBuffer, getS3Client, isMediaStorageConfigured } from "./mediaService";

const PUBLISH_SIG_TTL_SEC = 15 * 60;

export function createMediaPublishSignature(assetId: string, expUnix: number): string {
  return createHmac("sha256", JWT_SECRET)
    .update(`${assetId}:${expUnix}`)
    .digest("base64url");
}

export function verifyMediaPublishSignature(
  assetId: string,
  expUnix: number,
  sig: string
): boolean {
  if (expUnix * 1000 < Date.now()) return false;
  const expected = createMediaPublishSignature(assetId, expUnix);
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return false;
  }
}

export function buildSignedMediaPublishUrl(assetId: string): string {
  const exp = Math.floor(Date.now() / 1000) + PUBLISH_SIG_TTL_SEC;
  const sig = createMediaPublishSignature(assetId, exp);
  const base = NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return `${base}/api/v1/media/${assetId}/publish?exp=${exp}&sig=${sig}`;
}

export async function getPublicMediaUrlForMeta(assetId: string): Promise<string> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.id, assetId))
    .limit(1);
  if (!row) throw new Error("Mídia não encontrada.");

  const provider = getMediaStorageProvider();

  if (provider === "squareblob" && isSquareBlobConfigured()) {
    if (SQUARE_BLOB_PUBLIC_BASE) {
      return `${SQUARE_BLOB_PUBLIC_BASE.replace(/\/$/, "")}/${row.objectKey}`;
    }
  }

  if (provider === "minio" && isMediaStorageConfigured()) {
    const command = new GetObjectCommand({ Bucket: MINIO_BUCKET, Key: row.objectKey });
    return getSignedUrl(getS3Client(), command, { expiresIn: 3600 });
  }

  return buildSignedMediaPublishUrl(assetId);
}

export async function serveSignedPublishMedia(
  assetId: string,
  exp: number,
  sig: string
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  if (!verifyMediaPublishSignature(assetId, exp, sig)) return null;
  try {
    const { buffer, mimeType } = await getMediaBuffer(assetId);
    return { buffer, mimeType };
  } catch {
    return null;
  }
}

export function createOAuthState(clientId: string, userId: string): string {
  return jwt.sign({ clientId, userId, nonce: randomBytes(8).toString("hex") }, JWT_SECRET, {
    expiresIn: "15m",
  });
}

export function parseOAuthState(state: string): { clientId: string; userId: string } {
  const payload = jwt.verify(state, JWT_SECRET) as { clientId: string; userId: string };
  if (!payload.clientId || !payload.userId) throw new Error("State OAuth inválido.");
  return payload;
}
