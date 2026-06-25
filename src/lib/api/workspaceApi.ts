import { normalizeCanvaPages } from "../canva";
import type { BrandGem, CatalogItem, ContentScheduleItem, PlannedPost } from "../../types";
import type { ClientRegistry, ClientWorkspace } from "../clientWorkspace/types";
import type { ClientMeta } from "../clientWorkspace/types";
import type { PlanningPeriod } from "../planningConstants";
import { withAiHeaders } from "../aiFetch";
import { apiFetch, readApiJson } from "./apiClient";

export type ApiRegistry = ClientRegistry;

export type ApiWorkspaceResponse = {
  version: 1;
  client: ClientMeta;
  brandGem: BrandGem;
  catalog: CatalogItem[];
  posts: PlannedPost[];
  contentSchedule?: ContentScheduleItem[];
  startDate: string;
  activePlanningPeriodId: string;
  planningPeriods: PlanningPeriod[];
  isReadOnly?: boolean;
  defaultUsesReferences?: boolean;
  usesReferences?: boolean;
  canva: ClientWorkspace["canva"];
  ui?: ClientWorkspace["ui"];
};

export function apiWorkspaceToClientWorkspace(dto: ApiWorkspaceResponse): ClientWorkspace {
  const normalizedPages = normalizeCanvaPages(
    dto.canva.pages.map((page) => ({
      ...page,
      slots: (page.slots ?? []).filter(Boolean).map((slot) => {
        const imageFromDto =
          typeof slot.image === "string" ? resolveMediaUrl(slot.image) : null;
        const image =
          imageFromDto ??
          (slot.imageAssetId
            ? resolveMediaUrl(`/api/v1/media/${slot.imageAssetId}`)
            : null);
        return { ...slot, image };
      }),
    }))
  );

  return {
    version: 1,
    brandGem: dto.brandGem,
    catalog: dto.catalog
      .filter((c): c is CatalogItem => !!c?.id)
      .map((c) => ({
        ...c,
        image: resolveCatalogItemImage(c),
      })),
    posts: dto.posts
      .filter((p): p is PlannedPost => !!p?.id)
      .map((p) => ({
        ...p,
        image: resolveMediaUrl(typeof p.image === "string" ? p.image : null),
      })),
    contentSchedule: Array.isArray(dto.contentSchedule) ? dto.contentSchedule : [],
    startDate: dto.startDate,
    activePlanningPeriodId: dto.activePlanningPeriodId,
    planningPeriods: dto.planningPeriods ?? [],
    isReadOnly: dto.isReadOnly ?? false,
    periodEditMode: dto.isReadOnly ? "view_archived" : "active",
    defaultUsesReferences: dto.defaultUsesReferences ?? dto.client.defaultUsesReferences ?? true,
    usesReferences: dto.usesReferences ?? true,
    canva: {
      ...dto.canva,
      pages: normalizedPages,
    },
    ui: dto.ui,
  };
}

export async function fetchRegistry(): Promise<ApiRegistry> {
  const res = await apiFetch("/api/v1/clients");
  return readApiJson(res);
}

export async function fetchWorkspace(
  clientId: string,
  periodId?: string
): Promise<ApiWorkspaceResponse> {
  const qs = periodId ? `?periodId=${encodeURIComponent(periodId)}` : "";
  const res = await apiFetch(`/api/v1/clients/${clientId}/workspace${qs}`);
  return readApiJson(res);
}

export async function createClientApi(name: string, slug?: string): Promise<{ id: string; name: string }> {
  const res = await apiFetch("/api/v1/clients", {
    method: "POST",
    body: JSON.stringify({ name, slug }),
  });
  return readApiJson(res);
}

export async function patchWorkspaceApi(
  clientId: string,
  patch: Record<string, unknown>
) {
  const res = await apiFetch(`/api/v1/clients/${clientId}/workspace`, {
    method: "PATCH",
    body: JSON.stringify({
      ...patch,
      planningPeriodId: patch.planningPeriodId ?? patch.activePlanningPeriodId,
    }),
  });
  return readApiJson<ApiWorkspaceResponse>(res);
}

export async function fetchPlanningPeriodsApi(clientId: string) {
  const res = await apiFetch(`/api/v1/clients/${clientId}/planning-periods`);
  return readApiJson<{ periods: PlanningPeriod[] }>(res);
}

export async function createPlanningPeriodApi(
  clientId: string,
  body: {
    label?: string;
    startDate?: string;
    sourcePeriodId?: string;
    usesReferences?: boolean | null;
  }
) {
  const res = await apiFetch(`/api/v1/clients/${clientId}/planning-periods`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return readApiJson<{ period: PlanningPeriod; workspace: ApiWorkspaceResponse }>(res);
}

export async function activatePlanningPeriodApi(clientId: string, periodId: string) {
  const res = await apiFetch(
    `/api/v1/clients/${clientId}/planning-periods/${periodId}/activate`,
    { method: "POST" }
  );
  return readApiJson<{ period: PlanningPeriod; workspace: ApiWorkspaceResponse }>(res);
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
  options?: { isReference?: boolean; labels?: string[] }
) {
  const form = new FormData();
  for (const f of files) form.append("files", f);
  if (options?.isReference === false) form.append("isReference", "false");
  if (options?.labels?.length) form.append("labels", JSON.stringify(options.labels));
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

export async function deleteCatalogItemApi(clientId: string, itemId: string) {
  const res = await apiFetch(`/api/v1/clients/${clientId}/catalog/${itemId}`, {
    method: "DELETE",
  });
  return readApiJson(res);
}

export async function clearGridCatalogApi(clientId: string) {
  const res = await apiFetch(`/api/v1/clients/${clientId}/catalog/clear-grid`, {
    method: "POST",
  });
  return readApiJson(res);
}

export async function renameClientApi(clientId: string, name: string) {
  const res = await apiFetch(`/api/v1/clients/${clientId}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
  return readApiJson(res);
}

export async function clearCatalogEnrichmentsApi(clientId: string, ids?: string[]) {
  const res = await apiFetch(`/api/v1/clients/${clientId}/catalog/clear-enrichments`, {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
  return readApiJson<{ ok: boolean; embeddingsCleared?: boolean }>(res);
}

export type CatalogRevision = {
  revision: string;
  itemCount: number;
  readyCount: number;
  processingCount: number;
};

export type SyncRevisionDto = {
  periodId: string;
  catalog: CatalogRevision;
  workspace: string;
  brandGem: string;
  periods: string;
  registry: string;
  clientUpdatedAt: string;
};

export async function fetchSyncRevisionApi(clientId: string, periodId?: string) {
  const qs = periodId ? `?periodId=${encodeURIComponent(periodId)}` : "";
  const res = await apiFetch(`/api/v1/clients/${clientId}/sync-revision${qs}`);
  return readApiJson<SyncRevisionDto>(res);
}

export async function fetchCatalogRevisionApi(clientId: string) {
  const res = await apiFetch(`/api/v1/clients/${clientId}/catalog/revision`);
  return readApiJson<CatalogRevision>(res);
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
    return src.split("?")[0]!;
  }
  if (src.startsWith("/api/")) return src;
  return src;
}

/** URL exibível para item do catálogo (API blob ou data URL). */
export function resolveCatalogItemImage(
  item: Pick<CatalogItem, "image" | "imageUrl" | "imageAssetId"> | null | undefined
): string | null {
  if (!item) return null;
  if (item.image?.startsWith("data:")) return item.image;
  if (item.imageAssetId) {
    return resolveMediaUrl(`/api/v1/media/${item.imageAssetId}`);
  }
  return resolveMediaUrl(item.imageUrl ?? item.image);
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
