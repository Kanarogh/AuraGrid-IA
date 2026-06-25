import type { CanvaGridPage, CanvaGridSlot } from "../types";
import { resolveMediaUrl } from "./api/workspaceApi";

export function createEmptyCanvaPage(pageName: string, id: string): CanvaGridPage {
  const slots: CanvaGridSlot[] = [];
  for (let i = 0; i < 12; i++) {
    slots.push({
      id: `slot_${id}_${i}`,
      image: null,
      label: `Look ${i + 1}`,
      matchedCatalogId: null,
    });
  }
  return { id, name: pageName, slots };
}

export function canvaPageNumberedName(n: number): string {
  return `Página ${n}`;
}

/** Renumera páginas na ordem do array: Página 1, 2, 3… */
export function renumberCanvaPages(pages: CanvaGridPage[]): CanvaGridPage[] {
  return pages.map((page, index) => ({
    ...page,
    name: canvaPageNumberedName(index + 1),
  }));
}

/** Nova página no início; todas renumeradas em sequência. */
export function prependCanvaPage(pages: CanvaGridPage[], newPageId: string): CanvaGridPage[] {
  const newPage = createEmptyCanvaPage(canvaPageNumberedName(1), newPageId);
  return renumberCanvaPages([newPage, ...pages]);
}

/** Página ativa padrão: a última do array (fluxo Canva — página mais recente). */
export function getDefaultActiveCanvaPageId(pages: CanvaGridPage[]): string {
  if (pages.length === 0) return "page_1";
  return pages[pages.length - 1]!.id;
}

export function resolveActiveCanvaPage(
  pages: CanvaGridPage[],
  activePageId: string
): CanvaGridPage | undefined {
  if (pages.length === 0) return undefined;
  return (
    pages.find((p) => p.id === activePageId) ?? pages[pages.length - 1] ?? pages[0]
  );
}

/** URL exibível do slot (imagem inline ou mídia na API). */
export function resolveSlotImage(slot: CanvaGridSlot | null | undefined): string | null {
  if (!slot) return null;
  if (slot.image?.startsWith("data:") || slot.image?.startsWith("http")) {
    return slot.image;
  }
  if (slot.image) {
    return resolveMediaUrl(slot.image);
  }
  if (slot.imageAssetId) {
    return resolveMediaUrl(`/api/v1/media/${slot.imageAssetId}`);
  }
  return null;
}

export function isCanvaSlotFilled(slot: CanvaGridSlot | null | undefined): boolean {
  if (!slot) return false;
  return !!resolveSlotImage(slot) || !!slot.matchedCatalogId;
}

const SLOTS_PER_PAGE = 12;

/** Garante 12 slots por página (dados antigos ou API incompleta). */
export function normalizeCanvaPageSlots(
  pageId: string,
  slots: Array<CanvaGridSlot | null | undefined> | null | undefined
): CanvaGridSlot[] {
  const safe = (slots ?? []).filter((s): s is CanvaGridSlot => !!s?.id);
  const byIndex = new Map<number, CanvaGridSlot>();
  for (const slot of safe) {
    const match = /_(\d+)$/.exec(slot.id);
    const idx = match ? Number.parseInt(match[1]!, 10) : byIndex.size;
    if (idx >= 0 && idx < SLOTS_PER_PAGE) byIndex.set(idx, slot);
  }
  return Array.from({ length: SLOTS_PER_PAGE }, (_, i) => {
    const existing = byIndex.get(i);
    if (existing) {
      return {
        ...existing,
        image: existing.image ?? null,
        matchedCatalogId: existing.matchedCatalogId ?? null,
      };
    }
    return {
      id: `slot_${pageId}_${i}`,
      image: null,
      label: `Look ${i + 1}`,
      matchedCatalogId: null,
    };
  });
}

export function normalizeCanvaPages(pages: CanvaGridPage[] | null | undefined): CanvaGridPage[] {
  if (!Array.isArray(pages) || pages.length === 0) {
    return [createEmptyCanvaPage("Página 1", "page_1")];
  }
  return renumberCanvaPages(
    pages.map((page) => ({
      ...page,
      slots: normalizeCanvaPageSlots(page.id, page.slots),
    }))
  );
}

export type CanvaCatalogPlacement = { pageNumber: number; slotNumber: number };

export function formatCanvaPlacement(placement: CanvaCatalogPlacement): string {
  return `P${placement.pageNumber}L${placement.slotNumber}`;
}

function comparePlacements(a: CanvaCatalogPlacement, b: CanvaCatalogPlacement): number {
  if (a.pageNumber !== b.pageNumber) return a.pageNumber - b.pageNumber;
  return a.slotNumber - b.slotNumber;
}

/** Posição de cada look do catálogo em todas as páginas do grid (catalogId → PnLm). */
export function buildCatalogUsageAcrossPages(
  pages: CanvaGridPage[]
): Map<string, CanvaCatalogPlacement[]> {
  const map = new Map<string, CanvaCatalogPlacement[]>();
  pages.forEach((page, pageIndex) => {
    const pageNumber = pageIndex + 1;
    page.slots.forEach((slot, slotIndex) => {
      if (!slot.matchedCatalogId) return;
      const placement: CanvaCatalogPlacement = {
        pageNumber,
        slotNumber: slotIndex + 1,
      };
      const prev = map.get(slot.matchedCatalogId) ?? [];
      prev.push(placement);
      map.set(slot.matchedCatalogId, prev);
    });
  });
  for (const [catalogId, placements] of map) {
    placements.sort(comparePlacements);
    map.set(catalogId, placements);
  }
  return map;
}

export function resolveCanvaPageNumber(
  pages: CanvaGridPage[],
  activePageId: string
): number {
  const index = pages.findIndex((p) => p.id === activePageId);
  if (index >= 0) return index + 1;
  return pages.length > 0 ? pages.length : 1;
}
