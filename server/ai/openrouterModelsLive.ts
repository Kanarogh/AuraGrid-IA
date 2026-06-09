/**
 * Lista modelos free do OpenRouter via GET /api/v1/models (mesmos critérios do site).
 * @see https://openrouter.ai/models?output_modalities=text&input_modalities=image
 * @see https://openrouter.ai/models?output_modalities=image&input_modalities=image
 */

import type { OpenRouterModelOption } from "./openrouterModels";
import {
  filterOpenRouterCatalogVisionModelIds,
  isOpenRouterCatalogVisionModelId,
} from "./openrouterVisionFilter";

const CACHE_MS = 30 * 60 * 1000;

export type OpenRouterLiveModel = {
  id: string;
  name: string;
  label: string;
  description: string;
  vision: boolean;
  /** Entrada imagem + saída texto (indexar catálogo, legendas). */
  visionText: boolean;
  /** Entrada imagem + saída imagem. */
  visionImage: boolean;
  isFree: boolean;
  availableNow: boolean;
  source: "live";
  recommended?: boolean;
};

export type OpenRouterModelsFilter = "vision-text" | "vision-image" | "vision-any";

type OrPricing = {
  prompt?: string;
  completion?: string;
};

type OrModel = {
  id?: string;
  name?: string;
  description?: string;
  architecture?: {
    input_modalities?: string[];
    output_modalities?: string[];
  };
  pricing?: OrPricing;
};

let cached: {
  at: number;
  all: OpenRouterLiveModel[];
} | null = null;

function parsePrice(value: string | undefined): number {
  if (value === undefined || value === "") return NaN;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function isFreeTier(m: OrModel): boolean {
  const id = m.id ?? "";
  if (id === "openrouter/free" || id.endsWith(":free")) return true;
  const prompt = parsePrice(m.pricing?.prompt);
  const completion = parsePrice(m.pricing?.completion);
  return prompt === 0 && completion === 0;
}

function hasInput(modalities: string[], kind: string): boolean {
  return modalities.includes(kind);
}

function mapOrModel(m: OrModel): OpenRouterLiveModel | null {
  const id = m.id?.trim();
  if (!id) return null;

  const inputs = m.architecture?.input_modalities ?? [];
  const outputs = m.architecture?.output_modalities ?? [];
  const vision = hasInput(inputs, "image");
  if (!vision) return null;

  const visionText = hasInput(inputs, "image") && hasInput(outputs, "text");
  const visionImage = hasInput(inputs, "image") && hasInput(outputs, "image");
  const isFree = isFreeTier(m);
  if (!isFree) return null;
  if (!isOpenRouterCatalogVisionModelId(id)) return null;
  if (!visionText && !visionImage) return null;

  const name = m.name?.trim() || id;

  return {
    id,
    name,
    label: name.length > 48 ? `${name.slice(0, 45)}…` : name,
    description:
      m.description?.trim() ||
      `Free · entrada: ${inputs.join(", ")} · saída: ${outputs.join(", ") || "text"}`,
    vision: true,
    visionText,
    visionImage,
    isFree: true,
    availableNow: true,
    source: "live",
    recommended:
      /gemma-4-31b/i.test(id) ||
      /gemma-4-26b/i.test(id) ||
      /nemotron.*vl/i.test(id) ||
      /nemotron-3-nano-omni/i.test(id) ||
      /kimi-k2/i.test(id),
  };
}

async function fetchAllFreeVisionModels(apiKey: string): Promise<OpenRouterLiveModel[]> {
  const res = await fetch("https://openrouter.ai/api/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    throw new Error(`OpenRouter GET /models HTTP ${res.status}`);
  }

  const data = (await res.json()) as { data?: OrModel[] };
  const out: OpenRouterLiveModel[] = [];

  for (const m of data.data ?? []) {
    const mapped = mapOrModel(m);
    if (mapped) out.push(mapped);
  }

  out.sort((a, b) => {
    if (a.recommended !== b.recommended) return a.recommended ? -1 : 1;
    if (a.visionText !== b.visionText) return a.visionText ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return out;
}

export async function listLiveOpenRouterModels(
  apiKey: string,
  options?: { refresh?: boolean; filter?: OpenRouterModelsFilter }
): Promise<{
  models: OpenRouterLiveModel[];
  fetchedAt: string;
  fromCache: boolean;
}> {
  const filter = options?.filter ?? "vision-text";
  const now = Date.now();

  if (!options?.refresh && cached && now - cached.at < CACHE_MS) {
    return {
      models: applyFilter(cached.all, filter),
      fetchedAt: new Date(cached.at).toISOString(),
      fromCache: true,
    };
  }

  const all = await fetchAllFreeVisionModels(apiKey);
  cached = { at: now, all };

  if (all.length > 0) {
    console.info(
      `[OpenRouter] ${all.length} modelo(s) free com visão (API): ${all
        .slice(0, 4)
        .map((m) => m.id)
        .join(", ")}${all.length > 4 ? "…" : ""}`
    );
  } else {
    console.warn(
      "[OpenRouter] API não retornou modelos free com imagem — o site também pode mostrar vazio: " +
        "https://openrouter.ai/models?output_modalities=text&input_modalities=image"
    );
  }

  return {
    models: applyFilter(all, filter),
    fetchedAt: new Date(now).toISOString(),
    fromCache: false,
  };
}

function applyFilter(
  models: OpenRouterLiveModel[],
  filter: OpenRouterModelsFilter
): OpenRouterLiveModel[] {
  if (filter === "vision-text") return models.filter((m) => m.visionText);
  if (filter === "vision-image") return models.filter((m) => m.visionImage);
  return models;
}

/** IDs para cadeia de fallback de indexação (visão → texto). */
export async function fetchLiveOpenRouterVisionModelIds(
  apiKey: string
): Promise<string[]> {
  const { models } = await listLiveOpenRouterModels(apiKey, { filter: "vision-text" });
  const ids = models.map((m) => m.id);
  const withoutRouter = ids.filter((id) => id !== "openrouter/free");
  const ordered = filterOpenRouterCatalogVisionModelIds(withoutRouter);
  if (ids.includes("openrouter/free")) ordered.push("openrouter/free");
  return ordered;
}

export function clearOpenRouterModelsCache(): void {
  cached = null;
}

export function mergeOpenRouterModelsForUi(
  live: OpenRouterLiveModel[],
  curated: OpenRouterModelOption[]
): OpenRouterModelOption[] {
  const liveIds = new Set(live.map((m) => m.id));
  const merged: OpenRouterModelOption[] = live.map((m) => ({
    id: m.id,
    label: m.label,
    description: m.description,
    vision: m.vision,
    recommended: m.recommended,
    availableNow: true,
    source: "live" as const,
    visionText: m.visionText,
    visionImage: m.visionImage,
    isFree: m.isFree,
  }));

  for (const c of curated) {
    if (liveIds.has(c.id)) continue;
    merged.push({
      ...c,
      availableNow: false,
      source: "curated",
    });
  }

  return merged;
}
