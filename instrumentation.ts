export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { assertProductionJwtSecret } = await import("./server/config/jwtSecret");
  assertProductionJwtSecret();

  const { isDatabaseConfigured } = await import("./server/db/client");
  const { isOfflineStorageAllowed } = await import("./server/config/deploy");
  const { runMigrations } = await import("./server/db/migrate");
  const { loadRuntimeAiSettings } = await import("./server/ai/runtimeSettings");

  if (isDatabaseConfigured()) {
    try {
      await runMigrations();
      const { resetStaleEnrichJobs } = await import("./server/services/enrichJobStore");
      await resetStaleEnrichJobs();
      console.info("[AuraGrid] PostgreSQL conectado e migrations aplicadas.");
      const { isServerSyncDebugEnabled } = await import("./server/sync/syncDebugLog");
      const syncFlag = process.env.SYNC_DEBUG ?? process.env.NEXT_PUBLIC_SYNC_DEBUG ?? "(não definido)";
      console.log(
        `[AuraGrid:sync] terminal debug ${isServerSyncDebugEnabled() ? "ON" : "OFF"} (SYNC_DEBUG=${syncFlag})`
      );
      const { isPgvectorAvailable } = await import("./server/db/pgvector");
      if (!(await isPgvectorAvailable())) {
        console.warn(
          "[AuraGrid] pgvector indisponível — shortlist por embedding desativado (match por fingerprint/ranker continua)."
        );
      }
    } catch (err) {
      console.error("[AuraGrid] Falha ao conectar/migrar PostgreSQL:", err);
      const isProduction = process.env.NODE_ENV === "production";
      const isCloudDeploy = process.env.AURAGRID_CLOUD_DEPLOY === "1";
      if (isProduction || isCloudDeploy) {
        throw err;
      }
    }
  } else if (isOfflineStorageAllowed()) {
    console.warn("[AuraGrid] DATABASE_URL ausente — persistência local no navegador (somente dev).");
  } else {
    console.error(
      "[AuraGrid] DATABASE_URL ausente em produção. Configure PostgreSQL (Neon, Supabase, etc.) na Vercel."
    );
    const isCloudDeploy = process.env.AURAGRID_CLOUD_DEPLOY === "1";
    if (isCloudDeploy) {
      throw new Error("DATABASE_URL é obrigatório em AURAGRID_CLOUD_DEPLOY=1.");
    }
  }

  try {
    await loadRuntimeAiSettings();
  } catch (err) {
    console.error("[AuraGrid] Falha ao carregar configurações de IA:", err);
  }

  if (isDatabaseConfigured()) {
    try {
      const { startPublishWorker } = await import("./server/services/publishWorker");
      startPublishWorker();
    } catch (err) {
      console.error("[AuraGrid] Falha ao iniciar publish worker:", err);
    }
  }

}
