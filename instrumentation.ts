export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { isDatabaseConfigured } = await import("./server/db/client");
  const { isOfflineStorageAllowed } = await import("./server/config/deploy");
  const { runMigrations } = await import("./server/db/migrate");
  const { loadRuntimeAiSettings } = await import("./server/ai/runtimeSettings");

  if (isDatabaseConfigured()) {
    try {
      await runMigrations();
      console.info("[AuraGrid] PostgreSQL conectado e migrations aplicadas.");
      const { isPgvectorAvailable } = await import("./server/db/pgvector");
      if (!(await isPgvectorAvailable())) {
        console.warn(
          "[AuraGrid] pgvector indisponível — shortlist por embedding desativado (match por fingerprint/ranker continua)."
        );
      }
    } catch (err) {
      console.error("[AuraGrid] Falha ao conectar/migrar PostgreSQL:", err);
    }
  } else if (isOfflineStorageAllowed()) {
    console.warn("[AuraGrid] DATABASE_URL ausente — persistência local no navegador (somente dev).");
  } else {
    console.error(
      "[AuraGrid] DATABASE_URL ausente em produção. Configure PostgreSQL (Neon, Supabase, etc.) na Vercel."
    );
  }

  try {
    await loadRuntimeAiSettings();
  } catch (err) {
    console.error("[AuraGrid] Falha ao carregar configurações de IA:", err);
  }

  const { isServerSyncDebugEnabled } = await import("./server/sync/syncDebugLog");
  console.log(
    `[AuraGrid:sync] terminal debug ${isServerSyncDebugEnabled() ? "ON" : "OFF"} — SYNC_DEBUG=1 para ativar em produção`
  );
}
