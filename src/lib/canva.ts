import type { CanvaGridPage, CanvaGridSlot } from "../types";

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
