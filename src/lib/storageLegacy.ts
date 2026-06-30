/** Chaves legadas (AuraGrid) — migradas automaticamente na inicialização. */
const LEGACY = {
  registry: "auragrid_client_registry",
  brandGem: "auragrid_brand_gem",
  initialWipe: "auragrid_initial_wipe_done",
  workspacePrefix: "auragrid_ws:",
  accessToken: "auragrid_access_token",
  sidebarCollapsed: "auragrid_sidebar_collapsed",
  syncDebug: "aurastudio:sync-debug",
} as const;

export const STORAGE = {
  registry: "aurastudio_client_registry",
  brandGem: "aurastudio_brand_gem",
  initialWipe: "aurastudio_initial_wipe_done",
  workspacePrefix: "aurastudio_ws:",
  accessToken: "aurastudio_access_token",
  sidebarCollapsed: "aurastudio_sidebar_collapsed",
  syncDebug: "aurastudio:sync-debug",
} as const;

/** Migra localStorage de AuraGrid → AuraStudio (idempotente). */
export function migrateLegacyStorageKeys(): void {
  if (typeof window === "undefined") return;

  const migrateKey = (from: string, to: string) => {
    const value = window.localStorage.getItem(from);
    if (value != null && window.localStorage.getItem(to) == null) {
      window.localStorage.setItem(to, value);
    }
    if (value != null) window.localStorage.removeItem(from);
  };

  migrateKey(LEGACY.registry, STORAGE.registry);
  migrateKey(LEGACY.brandGem, STORAGE.brandGem);
  migrateKey(LEGACY.initialWipe, STORAGE.initialWipe);
  migrateKey(LEGACY.accessToken, STORAGE.accessToken);
  migrateKey(LEGACY.sidebarCollapsed, STORAGE.sidebarCollapsed);
  migrateKey(LEGACY.syncDebug, STORAGE.syncDebug);

  const wsKeys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key?.startsWith(LEGACY.workspacePrefix)) wsKeys.push(key);
  }
  for (const key of wsKeys) {
    const newKey = STORAGE.workspacePrefix + key.slice(LEGACY.workspacePrefix.length);
    migrateKey(key, newKey);
  }
}
