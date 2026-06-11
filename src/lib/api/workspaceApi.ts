import type { BrandGem, CatalogItem, PlannedPost } from "../../types";
import type { ClientRegistry, ClientWorkspace } from "../clientWorkspace/types";
import type { ClientMeta } from "../clientWorkspace/types";
import { withAiHeaders } from "../aiFetch";
import { apiFetch, getAccessToken, readApiJson } from "./apiClient";

export type ApiRegistry = ClientRegistry;

export type ApiWorkspaceResponse = {
  version: 1;
  client: ClientMeta;
  brandGem: BrandGem;
  catalog: CatalogItem[];
  posts: PlannedPost[];
  startDate: string;
  canva: ClientWorkspace["canva"];
  ui?: ClientWorkspace["ui"];
};

export function apiWorkspaceToClientWorkspace(dto: ApiWorkspaceResponse): ClientWorkspace {
  return {
    version: 1,
    brandGem: dto.brandGem,
    catalog: dto.catalog.map((c) => ({
      ...c,
      image: resolveCatalogItemImage(c),
    })),
    posts: dto.posts.map((p) => ({
      ...p,
      image: resolveMediaUrl(typeof p.image === "string" ? p.image : null),
    })),
    startDate: dto.startDate,
    canva: {
      ...dto.canva,
      pages: dto.canva.pages.map((page) => ({
        ...page,
        slots: page.slots.map((slot) => ({
          ...slot,
          image: resolveMediaUrl(typeof slot.image === "string" ? slot.image : null),
        })),
      })),
    },
    ui: dto.ui,
  };
}

export async function fetchRegistry(): Promise<ApiRegistry> {
  const res = await apiFetch("/api/v1/clients");
  return readApiJson(res);
}

export async function fetchWorkspace(clientId: string): Promise<ApiWorkspaceResponse> {
  const res = await apiFetch(`/api/v1/clients/${clientId}/workspace`);
  return readApiJson(res);
}

export async function createClientApi(name: string, slug?: string): Promise<{ id: string; name: string }> {
  const res = await apiFetch("/api/v1/clients", {
    method: "POST",
    body: JSON.stringify({ name, slug }),
  });
  return readApiJson(res);
}

export async function patchWorkspaceApi(clientId: string, patch: Partial<ClientWorkspace>) {
  const res = await apiFetch(`/api/v1/clients/${clientId}/workspace`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return readApiJson<ApiWorkspaceResponse>(res);
}

export async function activateClientApi(clientId: string) {
  const res = await apiFetch(`/api/v1/clients/${clientId}/activate`, { method: "POST" });
  return readApiJson(res);
}

export async function deleteClientApi(clientId: string) {
  const res = await apiFetch(`/api/v1/clients/${clientId}`, { method: "DELETE" });
  return readApiJson(res);
}

export async function resetClientApi(clientId: string) {
  const res = await apiFetch(`/api/v1/clients/${clientId}/reset`, { method: "POST" });
  return readApiJson<ApiWorkspaceResponse>(res);
}

export async function saveBrandGemApi(clientId: string, gem: BrandGem) {
  const res = await apiFetch(`/api/v1/clients/${clientId}/brand-gem`, {
    method: "PUT",
    body: JSON.stringify(gem),
  });
  return readApiJson<{ savedAt: string }>(res);
}

export async function uploadMediaApi(
  clientId: string,
  file: File | Blob,
  kind: "catalog" | "canva" | "posts" | "media" = "media"
): Promise<{ id: string; url: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("kind", kind);
  const res = await apiFetch(`/api/v1/clients/${clientId}/media`, {
    method: "POST",
    body: form,
  });
  return readApiJson(res);
}

export async function uploadCatalogBatchApi(
  clientId: string,
  files: File[],
  options?: { isReference?: boolean }
) {
  const form = new FormData();
  for (const f of files) form.append("files", f);
  if (options?.isReference === false) form.append("isReference", "false");
  const res = await apiFetch(`/api/v1/clients/${clientId}/catalog/batch`, {
    method: "POST",
    body: form,
  });
  return readApiJson<{ items: CatalogItem[] }>(res);
}

export async function clearCatalogApi(clientId: string) {
  const res = await apiFetch(`/api/v1/clients/${clientId}/catalog/clear`, { method: "POST" });
  return readApiJson(res);
}

export async function clearCatalogEnrichmentsApi(clientId: string, ids?: string[]) {
  const res = await apiFetch(`/api/v1/clients/${clientId}/catalog/clear-enrichments`, {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
  return readApiJson(res);
}

export async function enrichCatalogApi(clientId: string, ids?: string[]) {
  const res = await apiFetch(
    `/api/v1/clients/${clientId}/catalog/enrich`,
    withAiHeaders({
      method: "POST",
      body: JSON.stringify({ ids }),
    })
  );
  return readApiJson(res);
}

export async function stopEnrichCatalogApi(clientId: string) {
  const res = await apiFetch(`/api/v1/clients/${clientId}/catalog/enrich/stop`, {
    method: "POST",
  });
  return readApiJson(res);
}

export type CatalogEnrichProgress = {
  index: number;
  total: number;
  itemId: string;
  label: string;
};

export async function fetchEnrichStatusApi(clientId: string) {
  const res = await apiFetch(`/api/v1/clients/${clientId}/catalog/enrich/status`);
  return readApiJson<{ enriching: boolean; progress?: CatalogEnrichProgress | null }>(res);
}

export async function migrateLocalStorageApi(payload: unknown) {
  const res = await apiFetch("/api/v1/migrate/local-storage", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return readApiJson(res);
}

export function resolveMediaUrl(src: string | null | undefined): string | null {
  if (!src) return null;
  if (src.startsWith("data:") || src.startsWith("http")) return src;
  if (src.startsWith("/api/v1/media/")) {
    const token = getAccessToken();
    if (token) return `${src.split("?")[0]}?token=${encodeURIComponent(token)}`;
    return src.split("?")[0] ?? src;
  }
  if (src.startsWith("/api/")) return src;
  return src;
}

/** URL exibível para item do catálogo (API blob ou data URL). */
export function resolveCatalogItemImage(
  item: Pick<CatalogItem, "image" | "imageUrl" | "imageAssetId">
): string | null {
  const raw =
    item.image ??
    item.imageUrl ??
    (item.imageAssetId ? `/api/v1/media/${item.imageAssetId}` : null);
  return resolveMediaUrl(raw);
}

/** Converte URL da API em data URL para envio à IA (quando necessário no client). */
export async function fetchImageAsDataUrl(url: string): Promise<string> {
  if (url.startsWith("data:")) return url;
  const res = await apiFetch(url.startsWith("/") ? url : `/${url}`);
  if (!res.ok) throw new Error("Falha ao carregar imagem.");
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
