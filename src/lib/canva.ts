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
export function resolveSlotImage(slot: CanvaGridSlot): string | null {
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

export function isCanvaSlotFilled(slot: CanvaGridSlot): boolean {
  return !!resolveSlotImage(slot) || !!slot.matchedCatalogId;
}
