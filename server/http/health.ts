import { checkDatabaseConnection, isDatabaseConfigured } from "../db/client";
import { isOfflineStorageAllowed, resolveStorageMode } from "../config/deploy";
import { checkMinioConnection, isMediaStorageConfigured } from "../services/mediaService";
import { getMediaStorageProvider } from "../config/mediaStorage";
import { buildHealthResponse } from "../ai/index";

export async function buildExtendedHealth() {
  const ai = buildHealthResponse();
  const dbConfigured = isDatabaseConfigured();
  const minioConfigured = isMediaStorageConfigured();
  const storageProvider = getMediaStorageProvider();
  const [dbOk, minioOk] = await Promise.all([
    dbConfigured ? checkDatabaseConnection() : Promise.resolve(false),
    minioConfigured ? checkMinioConnection() : Promise.resolve(false),
  ]);

  return {
    ...ai,
    deploy: {
      offlineStorageAllowed: isOfflineStorageAllowed(),
    },
    storage: {
      mode: resolveStorageMode(dbConfigured, dbOk),
      database: { configured: dbConfigured, ok: dbOk },
      minio: {
        configured: minioConfigured,
        ok: minioOk,
        provider: storageProvider,
      },
    },
    apiVersion: 7,
  };
}
