import { checkDatabaseConnection, isDatabaseConfigured } from "../db/client";
import { isOfflineStorageAllowed, resolveStorageMode } from "../config/deploy";
import { checkMinioConnection, isMinioConfigured } from "../services/mediaService";
import { buildHealthResponse } from "../ai/index";

export async function buildExtendedHealth() {
  const ai = buildHealthResponse();
  const dbConfigured = isDatabaseConfigured();
  const minioConfigured = isMinioConfigured();
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
      minio: { configured: minioConfigured, ok: minioOk },
    },
    apiVersion: 7,
  };
}
