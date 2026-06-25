import { describe, expect, it } from "vitest";
import {
  buildCatalogUsageAcrossPages,
  createEmptyCanvaPage,
  formatCanvaPlacement,
} from "./canva";

describe("formatCanvaPlacement", () => {
  it("formats page and slot", () => {
    expect(formatCanvaPlacement({ pageNumber: 4, slotNumber: 11 })).toBe("P4L11");
  });
});

describe("buildCatalogUsageAcrossPages", () => {
  it("maps catalog ids across all pages", () => {
    const page3 = createEmptyCanvaPage("Página 3", "page_3");
    page3.slots[4] = {
      ...page3.slots[4]!,
      matchedCatalogId: "cat_a",
    };
    const page4 = createEmptyCanvaPage("Página 4", "page_4");
    page4.slots[10] = {
      ...page4.slots[10]!,
      matchedCatalogId: "cat_a",
    };
    page4.slots[0] = {
      ...page4.slots[0]!,
      matchedCatalogId: "cat_b",
    };

    const map = buildCatalogUsageAcrossPages([page3, page4]);
    expect(map.get("cat_a")).toEqual([
      { pageNumber: 1, slotNumber: 5 },
      { pageNumber: 2, slotNumber: 11 },
    ]);
    expect(map.get("cat_b")).toEqual([{ pageNumber: 2, slotNumber: 1 }]);
  });

  it("ignores slots without matchedCatalogId", () => {
    const page = createEmptyCanvaPage("Página 1", "page_1");
    page.slots[0] = {
      ...page.slots[0]!,
      image: "data:image/png;base64,x",
      matchedCatalogId: null,
    };
    expect(buildCatalogUsageAcrossPages([page]).size).toBe(0);
  });

  it("sorts placements by page then slot", () => {
    const p1 = createEmptyCanvaPage("Página 1", "p1");
    const p2 = createEmptyCanvaPage("Página 2", "p2");
    p2.slots[11] = { ...p2.slots[11]!, matchedCatalogId: "cat_x" };
    p1.slots[2] = { ...p1.slots[2]!, matchedCatalogId: "cat_x" };

    const placements = buildCatalogUsageAcrossPages([p1, p2]).get("cat_x");
    expect(placements).toEqual([
      { pageNumber: 1, slotNumber: 3 },
      { pageNumber: 2, slotNumber: 12 },
    ]);
  });
});
