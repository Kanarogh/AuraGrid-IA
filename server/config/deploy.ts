/** Produção (Vercel, etc.): sem persistência local no navegador nem Ollama. */
export function isOfflineStorageAllowed(): boolean {
  if (process.env.AURAGRID_CLOUD_DEPLOY === "1") return false;
  return process.env.NODE_ENV !== "production";
}

/** Ollama só em desenvolvimento local. */
export function isLocalAiAllowed(): boolean {
  return isOfflineStorageAllowed();
}

export function resolveStorageMode(dbConfigured: boolean, dbOk: boolean): "postgresql" | "local" {
  if (dbConfigured && dbOk) return "postgresql";
  if (!isOfflineStorageAllowed()) return "postgresql";
  return "local";
}
