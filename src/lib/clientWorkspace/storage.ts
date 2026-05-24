import { createClientMeta, createEmptyWorkspace, normalizeWorkspace } from "./factory";
import type { ClientMeta, ClientRegistry, ClientWorkspace } from "./types";
import { REGISTRY_KEY, workspaceStorageKey } from "./types";

export function resolveWorkspaceForClient(
  clientId: string,
  meta: ClientMeta
): ClientWorkspace {
  const raw = loadWorkspaceRaw(clientId);
  return normalizeWorkspace(raw, meta);
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
  return normalizeWorkspace(raw, clientMeta);
}

export function saveWorkspace(clientId: string, workspace: ClientWorkspace): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(workspaceStorageKey(clientId), JSON.stringify(workspace));
}

export function deleteWorkspace(clientId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(workspaceStorageKey(clientId));
}

export function clearClientCaptionCache(clientId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(`ag.captionCache.v1:${clientId}`);
}
