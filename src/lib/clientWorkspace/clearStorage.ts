import { createEmptyRegistry } from "./migrate";
import { saveRegistry } from "./storage";
import { WORKSPACE_KEY_PREFIX } from "./types";

const STATIC_KEYS = [
  "auragrid_client_registry",
  "auragrid_brand_gem",
  "auragrid_initial_wipe_done",
  "palak_catalog",
  "palak_posts",
  "palak_start_date",
  "palak_canva_pages",
  "palak_active_canva_page_id",
  "palak_auto_sync_canva",
  "palak_canva_reversed",
  "palak_context",
  "palak_repeating",
  "ag.captionCache.v1",
] as const;

/** Remove todos os dados do app no localStorage (workspaces, catálogo, roteiro, cache). */
export function clearAllAuraGridStorage(): void {
  if (typeof window === "undefined") return;

  for (const key of STATIC_KEYS) {
    window.localStorage.removeItem(key);
  }

  const toRemove: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key) continue;
    if (
      key.startsWith(WORKSPACE_KEY_PREFIX) ||
      key.startsWith("ag.captionCache.v1:")
    ) {
      toRemove.push(key);
    }
  }
  toRemove.forEach((k) => window.localStorage.removeItem(k));
}

export function runOneTimeStorageWipe(): void {
  const WIPE_MARKER = "auragrid_wipe_2026_05";
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(WIPE_MARKER) === "done") return;

  clearAllAuraGridStorage();
  window.localStorage.setItem(WIPE_MARKER, "done");
  console.info("[AuraGrid] Dados locais apagados. Workspace zerado na próxima carga.");
}

/** Apaga clientes e workspaces; deixa registry vazio para cadastro do zero. */
export function runClientsZeroWipe(): void {
  const WIPE_MARKER = "auragrid_clients_zero_v2";
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(WIPE_MARKER) === "done") return;

  clearAllAuraGridStorage();
  saveRegistry(createEmptyRegistry());
  window.localStorage.setItem(WIPE_MARKER, "done");
  console.info("[AuraGrid] Clientes zerados. Crie uma nova marca em + Novo.");
}
