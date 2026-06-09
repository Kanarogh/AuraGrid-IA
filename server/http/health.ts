import { checkDatabaseConnection, isDatabaseConfigured } from "../db/client";
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
    storage: {
      mode: dbConfigured && dbOk ? "postgresql" : "local",
      database: { configured: dbConfigured, ok: dbOk },
      minio: { configured: minioConfigured, ok: minioOk },
    },
    apiVersion: 7,
  };
}
