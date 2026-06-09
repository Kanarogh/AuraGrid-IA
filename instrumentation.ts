export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { isDatabaseConfigured } = await import("./server/db/client");
  const { runMigrations } = await import("./server/db/migrate");
  const { loadRuntimeAiSettings } = await import("./server/ai/runtimeSettings");

  if (isDatabaseConfigured()) {
    try {
      await runMigrations();
      console.info("[AuraGrid] PostgreSQL conectado e migrations aplicadas.");
    } catch (err) {
      console.error("[AuraGrid] Falha ao conectar/migrar PostgreSQL:", err);
    }
  } else {
    console.warn("[AuraGrid] DATABASE_URL ausente — persistência local no navegador.");
  }

  try {
    await loadRuntimeAiSettings();
  } catch (err) {
    console.error("[AuraGrid] Falha ao carregar configurações de IA:", err);
  }
}
