/** Modo de persistência — `pending` até `/api/health` resolver. */
export type StorageMode = "pending" | "postgresql" | "local";

export type ResolvedStorageMode = "postgresql" | "local";

export function readStorageModeEnvHint(): ResolvedStorageMode | null {
  const hint = process.env.NEXT_PUBLIC_STORAGE_MODE;
  if (hint === "postgresql" || hint === "local") return hint;
  return null;
}

/** Estado inicial do AuthProvider (cache de sessão ou hint de env). */
export function resolveInitialStorageMode(
  cached: ResolvedStorageMode | undefined
): StorageMode {
  if (cached) return cached;
  return readStorageModeEnvHint() ?? "pending";
}

export function isStorageModeResolved(mode: StorageMode): mode is ResolvedStorageMode {
  return mode === "postgresql" || mode === "local";
}
