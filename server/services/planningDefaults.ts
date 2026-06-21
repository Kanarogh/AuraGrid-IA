export const DEFAULT_START_DATE = "2026-05-24";
export const POST_COUNT = 30;

export function defaultPeriodId(clientId: string, suffix = "default"): string {
  return `${clientId}__period_${suffix}`;
}

export function defaultCanvaPages(clientId: string, planningPeriodId: string) {
  const pageDefs = [
    { id: "page_1", name: "Página 1", sortOrder: 0 },
    { id: "page_2", name: "Página 2", sortOrder: 1 },
    { id: "page_3", name: "Página 3", sortOrder: 2 },
    { id: "page_4", name: "Página 4", sortOrder: 3 },
  ];
  const pages = pageDefs.map((p) => ({ ...p, clientId, planningPeriodId }));
  const slots = pageDefs.flatMap((p) =>
    Array.from({ length: 12 }, (_, i) => ({
      id: `slot_${p.id}_${i}`,
      clientId,
      planningPeriodId,
      pageId: p.id,
      slotIndex: i,
      label: `Look ${i + 1}`,
      matchedCatalogId: null as string | null,
      imageAssetId: null as string | null,
    }))
  );
  return { pages, slots, activePageId: "page_4" as const };
}

export function defaultPosts(clientId: string, planningPeriodId: string) {
  return Array.from({ length: POST_COUNT }, (_, i) => {
    const day = i + 1;
    return {
      id: `post_day${day}`,
      clientId,
      planningPeriodId,
      dayNumber: day,
      dateLabel: `Dia ${day}`,
      imageAssetId: null as string | null,
      canvaSlotId: null as string | null,
      matchedCatalogId: null as string | null,
      reasoning: null as string | null,
      caption: "",
      isGenerated: false,
      isConfirmed: false,
      captionFromImageOnly: false,
      lastError: null as string | null,
    };
  });
}

export function periodLabelFromDate(startDate: string): string {
  try {
    const [year, month] = startDate.split("-").map(Number);
    const d = new Date(year, month - 1, 1);
    const monthName = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    return monthName.charAt(0).toUpperCase() + monthName.slice(1);
  } catch {
    return "Roteiro";
  }
}
