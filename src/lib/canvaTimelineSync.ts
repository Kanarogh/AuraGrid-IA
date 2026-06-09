import { recalculatePostDates } from "./dates";
import type { CanvaGridPage, CanvaGridSlot, PlannedPost } from "../types";

export type CanvaSlotWithPage = CanvaGridSlot & { pageId: string };

export function gatherCanvaSlots(pages: CanvaGridPage[]): CanvaSlotWithPage[] {
  const all: CanvaSlotWithPage[] = [];
  for (const page of pages || []) {
    if (!page?.slots) continue;
    for (const slot of page.slots) {
      all.push({ ...slot, pageId: page.id });
    }
  }
  return all;
}

export function countCanvaImages(pages: CanvaGridPage[]): number {
  return gatherCanvaSlots(pages).filter((s) => s.image !== null).length;
}

function shouldPreserveSyncedPost(
  existing: PlannedPost | undefined,
  item: CanvaSlotWithPage
): boolean {
  if (!existing) return false;
  if (existing.image && existing.image === item.image) return true;
  if (existing.canvaSlotRef?.slotId === item.id) return true;
  if (
    existing.canvaSlotRef?.pageId === item.pageId &&
    existing.canvaSlotRef?.slotId === item.id
  ) {
    return true;
  }
  const hasEditorial =
    !!existing.caption?.trim() ||
    existing.isGenerated ||
    existing.isConfirmed ||
    !!existing.reasoning?.trim();
  if (hasEditorial && !existing.image && item.image) return true;
  return false;
}

/** Distribui looks do Canva Grid no roteiro de 30 dias, preservando legendas existentes. */
export function syncCanvaPagesToPosts(
  pages: CanvaGridPage[],
  existingPosts: PlannedPost[],
  startDate: string,
  options: { reversed: boolean }
): PlannedPost[] {
  const validSlots = gatherCanvaSlots(pages).filter((s) => s.image !== null);
  if (validSlots.length === 0) return existingPosts;

  let orderedSlots = [...validSlots];
  if (options.reversed) {
    orderedSlots.reverse();
  }

  const N = orderedSlots.length;
  const postsPerDay = Array(30).fill(0);

  if (N >= 30) {
    for (let i = 0; i < 30; i++) postsPerDay[i] = 1;
    let remaining = N - 30;
    let d = 0;
    while (remaining > 0 && d < 30) {
      const currentSpace = 3 - postsPerDay[d];
      if (currentSpace > 0) {
        const add = Math.min(currentSpace, remaining);
        postsPerDay[d] += add;
        remaining -= add;
      }
      d++;
    }
    let cycle = 0;
    while (remaining > 0) {
      postsPerDay[cycle % 30] += 1;
      remaining--;
      cycle++;
    }
  } else {
    for (let i = 0; i < N; i++) postsPerDay[i] = 1;
    for (let i = N; i < 30; i++) postsPerDay[i] = 0;
  }

  const existing = [...(existingPosts || [])];
  const resultPosts: PlannedPost[] = [];
  let itemIndex = 0;

  for (let dIndex = 0; dIndex < 30; dIndex++) {
    const dayNum = dIndex + 1;
    const countForDay = postsPerDay[dIndex];

    if (countForDay === 0) {
      const currentFlatIndex = resultPosts.length;
      const existingAtSlot = existing[currentFlatIndex];

      if (existingAtSlot && existingAtSlot.image === null) {
        resultPosts.push({
          ...existingAtSlot,
          dayNumber: dayNum,
          dateLabel: "",
        });
      } else {
        resultPosts.push({
          id: `post_day${dayNum}_blank_${Date.now()}_${dIndex}`,
          dayNumber: dayNum,
          dateLabel: "",
          image: null,
          matchedCatalogId: null,
          reasoning: null,
          caption: "",
          isGenerating: false,
          isGenerated: false,
          isConfirmed: false,
          error: null,
        });
      }
    } else {
      for (let pIndex = 0; pIndex < countForDay; pIndex++) {
        const item = orderedSlots[itemIndex];
        itemIndex++;

        const currentFlatIndex = resultPosts.length;
        const existingAtSlot = existing[currentFlatIndex];

        if (item && shouldPreserveSyncedPost(existingAtSlot, item)) {
          resultPosts.push({
            ...existingAtSlot!,
            image: item.image,
            matchedCatalogId:
              existingAtSlot!.matchedCatalogId ?? item.matchedCatalogId ?? null,
            canvaSlotRef: { pageId: item.pageId, slotId: item.id },
            dayNumber: dayNum,
            dateLabel: "",
          });
        } else {
          resultPosts.push({
            id: `post_day${dayNum}_p${pIndex}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            dayNumber: dayNum,
            dateLabel: "",
            image: item?.image ?? null,
            matchedCatalogId: item?.matchedCatalogId ?? null,
            canvaSlotRef: item ? { pageId: item.pageId, slotId: item.id } : null,
            reasoning:
              item?.matchedCatalogId
                ? "Vínculo automático via distribuidor inteligente de acervo."
                : null,
            caption: "",
            isGenerating: false,
            isGenerated: false,
            isConfirmed: false,
            error: null,
          });
        }
      }
    }
  }

  return recalculatePostDates(startDate, resultPosts);
}
