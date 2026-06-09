import type { CatalogItem, CatalogVisualProfile } from "../types";

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
function wasAutoImported(item: CatalogItem): boolean {
  const d = item.description?.toLowerCase() ?? "";
  return (
    d.includes("canva grid") ||
    d.includes("calendário de 30") ||
    d.includes("gerador de calendário")
  );
}

export function normalizeCatalogItem(item: CatalogItem): CatalogItem {
  const isReference =
    item.isReference === true || item.isReference === false
      ? item.isReference
      : !wasAutoImported(item);
  const next: CatalogItem = { ...item, isReference };
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

export function isCatalogItemIndexed(item: CatalogItem): boolean {
  return item.enrichmentStatus === "ready" && !!item.visualProfile;
}

/** Referência com JSON de visão, erro de indexação ou status final — dá para limpar. */
export function hasCatalogEnrichmentData(item: CatalogItem): boolean {
  return (
    !!item.visualProfile ||
    item.enrichmentStatus === "ready" ||
    item.enrichmentStatus === "failed" ||
    !!item.enrichedAt ||
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
