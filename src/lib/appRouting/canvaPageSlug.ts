export type CanvaPageRouteRef = { id: string };

const PAGE_SLUG = /^pagina-(\d+)$/i;

/** Slug legível na URL — pagina-N (N = posição 1-based em canvaPages). */
export function isCanvaPageUrlSlug(segment: string): boolean {
  return PAGE_SLUG.test(segment.trim());
}

/** ID interno legado (page_1, page_1702397366456_tcm8, etc.). */
export function isLegacyCanvaPageSegment(segment: string): boolean {
  return /^page_/.test(segment.trim());
}

export function canvaPageIdToUrlSlug(
  pageId: string,
  pages: CanvaPageRouteRef[]
): string | undefined {
  const idx = pages.findIndex((p) => p.id === pageId);
  if (idx < 0) return undefined;
  return `pagina-${idx + 1}`;
}

/** Resolve segmento bruto do path → id interno da página. */
export function resolveCanvaPageSegmentToId(
  pages: CanvaPageRouteRef[],
  segment: string | undefined
): string | undefined {
  if (!segment?.trim() || pages.length === 0) return undefined;

  const raw = segment.trim();

  const byId = pages.find((p) => p.id === raw);
  if (byId) return byId.id;

  const slugMatch = PAGE_SLUG.exec(raw);
  if (slugMatch) {
    const n = Number.parseInt(slugMatch[1]!, 10);
    if (n >= 1 && n <= pages.length) return pages[n - 1]!.id;
    return undefined;
  }

  return undefined;
}

/** Indica se o segmento na URL usa formato legado (precisa canonical replace). */
export function canvaPageSegmentNeedsCanonicalReplace(
  segment: string | undefined,
  pages: CanvaPageRouteRef[],
  resolvedPageId: string | undefined
): boolean {
  if (!segment?.trim() || !resolvedPageId) return false;
  const trimmed = segment.trim();
  if (isCanvaPageUrlSlug(trimmed)) return false;
  const canonical = canvaPageIdToUrlSlug(resolvedPageId, pages);
  return Boolean(canonical && canonical !== trimmed);
}
