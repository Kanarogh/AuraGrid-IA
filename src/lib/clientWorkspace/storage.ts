import { resizeForCatalogStorageEmergency } from "../images";
import { createClientMeta, createEmptyWorkspace, normalizeWorkspace } from "./factory";
import {
  compactWorkspaceForStorage,
  hydrateWorkspaceFromStorage,
  isStorageQuotaError,
} from "./persistence";
import type { ClientMeta, ClientRegistry, ClientWorkspace } from "./types";
import { REGISTRY_KEY, workspaceStorageKey } from "./types";

export type SaveWorkspaceResult =
  | { ok: true }
  | { ok: false; reason: "quota" | "error"; message: string };

export function resolveWorkspaceForClient(
  clientId: string,
  meta: ClientMeta
): ClientWorkspace {
  const raw = loadWorkspaceRaw(clientId);
  const normalized = normalizeWorkspace(raw, meta);
  return hydrateWorkspaceFromStorage(normalized);
}

function loadWorkspaceRaw(clientId: string): Partial<ClientWorkspace> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(workspaceStorageKey(clientId));
    if (!raw) return null;
    return JSON.parse(raw) as Partial<ClientWorkspace>;
  } catch {
    return null;
  }
}

export function loadRegistry(): ClientRegistry | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(REGISTRY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ClientRegistry;
    if (parsed?.version !== 1 || !Array.isArray(parsed.clients)) {
      return null;
    }
    if (parsed.clients.length === 0) {
      return { version: 1, activeClientId: "", clients: [] };
    }
    if (!parsed.activeClientId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveRegistry(registry: ClientRegistry): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
}

export function loadWorkspace(clientId: string, meta?: ClientMeta): ClientWorkspace | null {
  if (typeof window === "undefined") return null;
  const raw = loadWorkspaceRaw(clientId);
  if (!raw) return null;
  const clientMeta = meta ?? createClientMeta(clientId, raw.brandGem?.name ?? clientId);
  return hydrateWorkspaceFromStorage(normalizeWorkspace(raw, clientMeta));
}

export function saveWorkspace(
  clientId: string,
  workspace: ClientWorkspace
): SaveWorkspaceResult {
  if (typeof window === "undefined") return { ok: true };

  const compact = compactWorkspaceForStorage(workspace);
  try {
    window.localStorage.setItem(workspaceStorageKey(clientId), JSON.stringify(compact));
    return { ok: true };
  } catch (err) {
    if (isStorageQuotaError(err)) {
      return {
        ok: false,
        reason: "quota",
        message: "Espaço do navegador esgotado ao salvar o workspace.",
      };
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[AuraGrid] Falha ao salvar workspace:", err);
    return { ok: false, reason: "error", message };
  }
}

/** Tenta salvar; se o localStorage encher, recompacta fotos do catálogo e tenta de novo. */
export async function saveWorkspaceResilient(
  clientId: string,
  workspace: ClientWorkspace
): Promise<SaveWorkspaceResult> {
  const first = saveWorkspace(clientId, workspace);
  if (first.ok) return first;
  if (first.ok === false && first.reason !== "quota") return first;

  const catalog = await Promise.all(
    workspace.catalog.map(async (item) => {
      if (!item.image?.startsWith("data:")) return item;
      try {
        return { ...item, image: await resizeForCatalogStorageEmergency(item.image) };
      } catch {
        return item;
      }
    })
  );

  const second = saveWorkspace(clientId, { ...workspace, catalog });
  if (second.ok) {
    console.warn(
      "[AuraGrid] Catálogo salvo com compressão extra — limite de armazenamento do navegador."
    );
  }
  return second;
}

export function deleteWorkspace(clientId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(workspaceStorageKey(clientId));
}

export function clearClientCaptionCache(clientId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(`ag.captionCache.v1:${clientId}`);
}
