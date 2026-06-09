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
