import { checkDatabaseConnection, isDatabaseConfigured } from "../db/client";
import { getMigrationStatus } from "../db/migrationStatus";
import { isOfflineStorageAllowed, resolveStorageMode } from "../config/deploy";
import { checkMinioConnection, isMediaStorageConfigured } from "../services/mediaService";
import { getMediaStorageProvider } from "../config/mediaStorage";
import { buildHealthResponse } from "../ai/index";

export async function buildExtendedHealth() {
  const ai = buildHealthResponse();
  const dbConfigured = isDatabaseConfigured();
  const minioConfigured = isMediaStorageConfigured();
  const storageProvider = getMediaStorageProvider();
  const dbOk = dbConfigured ? await checkDatabaseConnection() : false;
  const [minioOk, migrations] = await Promise.all([
    minioConfigured ? checkMinioConnection() : Promise.resolve(false),
    dbConfigured && dbOk ? getMigrationStatus().catch(() => null) : Promise.resolve(null),
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
      migrations: migrations
        ? {
            pending: migrations.pending,
            contentScheduleReady: migrations.contentScheduleReady,
            ok: migrations.pending.length === 0,
          }
        : null,
    },
    apiVersion: 7,
  };
}
