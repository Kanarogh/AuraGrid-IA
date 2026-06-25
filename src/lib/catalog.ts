import type { CatalogItem, CatalogVisualProfile } from "../types";
import { catalogProfileV2ToDisplay, isCatalogProfileV2 } from "./catalogProfileDisplay";

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

function asString(value: unknown, fallback = "—"): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

/** Garante arrays e campos obrigatórios — a IA às vezes omite listas no JSON. */
export function normalizeVisualProfile(
  raw: Partial<CatalogVisualProfile> | Record<string, unknown> | undefined,
  label?: string
): CatalogVisualProfile {
  const p = (raw ?? {}) as Record<string, unknown>;
  if (isCatalogProfileV2(p)) {
    return catalogProfileV2ToDisplay(p, label);
  }
  const pattern =
    p.pattern && typeof p.pattern === "object" && !Array.isArray(p.pattern)
      ? (p.pattern as Record<string, unknown>)
      : {};

  return {
    version: 1,
    referenceLabel: asString(p.referenceLabel, label ?? "—"),
    garmentType: asString(p.garmentType),
    category: asString(p.category),
    dominantColorFamily: asString(
      p.dominantColorFamily,
      asStringArray(p.primaryColors)[0] ?? "—"
    ),
    colorTemperature:
      p.colorTemperature === "warm" ||
      p.colorTemperature === "cool" ||
      p.colorTemperature === "neutral"
        ? p.colorTemperature
        : undefined,
    primaryColors: asStringArray(p.primaryColors),
    secondaryColors: asStringArray(p.secondaryColors),
    pattern: {
      type: asString(pattern.type),
      description: asString(pattern.description),
    },
    printScale: asString(p.printScale, "") || undefined,
    neckline: asString(p.neckline),
    sleeves: asString(p.sleeves),
    sleeveType: asString(p.sleeveType, asString(p.sleeves)) || undefined,
    dressLength: asString(p.dressLength),
    lengthCategory: asString(p.lengthCategory, asString(p.dressLength)) || undefined,
    silhouette: asString(p.silhouette),
    fabricTexture: asString(p.fabricTexture),
    embellishments: asStringArray(p.embellishments),
    distinctiveDetails: asStringArray(p.distinctiveDetails),
    matchAnchors: asStringArray(p.matchAnchors).length
      ? asStringArray(p.matchAnchors)
      : undefined,
    notToConfuseWith: asString(p.notToConfuseWith, "") || undefined,
    matchKeywords: asStringArray(p.matchKeywords),
    visualSummary: asString(p.visualSummary, "Resumo visual não disponível."),
    distinguishingFingerprint: asString(p.distinguishingFingerprint),
  };
}

/** Itens importados automaticamente por Canva/calendário — não são referência de showroom */
export function wasAutoImported(item: CatalogItem): boolean {
  const d = item.description?.toLowerCase() ?? "";
  return (
    d.includes("canva grid") ||
    d.includes("calendário de 30") ||
    d.includes("gerador de calendário")
  );
}

/** Remove perfil antigo quando o status não é "ready" (estado inconsistente). */
export function sanitizeEnrichmentConsistency(item: CatalogItem): CatalogItem {
  const next = { ...item };
  if (next.enrichmentStatus !== "ready") {
    if (next.visualProfile) next.visualProfile = undefined;
    if (next.enrichmentStatus !== "failed") {
      next.enrichedAt = undefined;
    }
  } else if (!next.visualProfile) {
    next.enrichmentStatus = "pending";
  }
  return next;
}

export function normalizeCatalogItem(item: CatalogItem): CatalogItem {
  const isReference =
    item.isReference === true || item.isReference === false
      ? item.isReference
      : !wasAutoImported(item);
  const next: CatalogItem = sanitizeEnrichmentConsistency({ ...item, isReference });
  if (next.visualProfile) {
    next.visualProfile = normalizeVisualProfile(next.visualProfile, next.label);
  }
  return next;
}

export function isReferenceCatalogItem(item: CatalogItem): boolean {
  return item.isReference !== false;
}

export function getReferenceCatalog(catalog: CatalogItem[]): CatalogItem[] {
  return catalog.filter(isReferenceCatalogItem);
}

export function isGridCatalogItem(item: CatalogItem): boolean {
  return item.isReference === false && !wasAutoImported(item);
}

/** Fotos de grid/atmosfera (banners, lifestyle) — não entram na IA de match */
export function getGridCatalog(catalog: CatalogItem[]): CatalogItem[] {
  return catalog.filter(isGridCatalogItem);
}

/** Itens legados do Canva/calendário que não devem ficar no acervo */
export function isAutoImportedCatalogItem(item: CatalogItem): boolean {
  return item.isReference === false && wasAutoImported(item);
}

/** Looks + peças de grid para arrastar no Canva */
export function getCanvaCatalog(catalog: CatalogItem[]): CatalogItem[] {
  return catalog.filter((item) => isReferenceCatalogItem(item) || isGridCatalogItem(item));
}

export function isCatalogItemIndexed(item: CatalogItem): boolean {
  return item.enrichmentStatus === "ready" && !!item.visualProfile;
}

/** Referência com JSON de visão, erro de indexação ou status final — dá para limpar. */
export function hasCatalogEnrichmentData(item: CatalogItem): boolean {
  return (
    isCatalogItemIndexed(item) ||
    item.enrichmentStatus === "failed" ||
    !!item.enrichmentError
  );
}

export type CatalogEnrichmentClearPatch = Pick<
  CatalogItem,
  "visualProfile" | "enrichmentStatus" | "enrichedAt" | "enrichmentError"
>;

export function clearCatalogEnrichmentPatch(): CatalogEnrichmentClearPatch {
  return {
    visualProfile: undefined,
    enrichmentStatus: "pending",
    enrichedAt: undefined,
    enrichmentError: undefined,
  };
}

/** Zera indexação local antes de reindexar (evita "Ver perfil" com JSON antigo). */
export function prepareCatalogItemForEnrichment(item: CatalogItem): CatalogItem {
  return sanitizeEnrichmentConsistency({
    ...item,
    ...clearCatalogEnrichmentPatch(),
  });
}

/** Mescla itens por id (incoming vence) e remove duplicatas visuais na ordem do lote. */
export function mergeCatalogItems(
  existing: CatalogItem[],
  incoming: CatalogItem[],
  options?: { prependIncoming?: boolean }
): CatalogItem[] {
  if (incoming.length === 0) return existing;
  const incomingById = new Map(
    incoming.map((item) => [item.id, normalizeCatalogItem(item)])
  );
  const kept = existing.filter((item) => !incomingById.has(item.id));
  const resolvedIncoming = incoming.map((item) => incomingById.get(item.id)!);
  return options?.prependIncoming === false
    ? [...kept, ...resolvedIncoming]
    : [...resolvedIncoming, ...kept];
}

/** Garante lista sem ids repetidos (primeira ocorrência vence). */
export function dedupeCatalogItems(items: CatalogItem[]): CatalogItem[] {
  const seen = new Set<string>();
  const out: CatalogItem[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}
