import { describe, expect, it } from "vitest";
import { createEmptyCanvaPage } from "./canva";
import { buildPostsFromSchedule, canvaSlotsToScheduleItems } from "./canvaTimelineSync";
import { DEFAULT_DISTRIBUTION_PREFS, computePostsPerDay, resolveDistributionOptions } from "./smartDistribution";
import { POST_COUNT } from "./planningConstants";
import { sortPostsForInstagramProfile } from "./instagramFeedOrder";

function makePageWithImages(pageId: string): ReturnType<typeof createEmptyCanvaPage> {
  const page = createEmptyCanvaPage("Página 1", pageId);
  page.slots.forEach((slot, i) => {
    slot.image = `img-${i + 1}`;
    slot.label = `L${i + 1}`;
  });
  return page;
}

describe("sortPostsForInstagramProfile", () => {
  it("espelha a ordem visual do Grid Canva (L1 no topo-esquerda com reversed=true)", () => {
    const page = makePageWithImages("page_1");
    const pages = [page];
    const reversed = true;

    const items = canvaSlotsToScheduleItems(pages, reversed);
    const resolved = resolveDistributionOptions(items.length, DEFAULT_DISTRIBUTION_PREFS, POST_COUNT);
    const postsPerDay = computePostsPerDay(items.length, resolved);
    const posts = buildPostsFromSchedule(items, postsPerDay, [], "2024-06-01");

    const ordered = sortPostsForInstagramProfile(posts, {
      canvaPages: pages,
      canvaGridReversed: reversed,
    }).filter((p) => p.image);

    expect(ordered.map((p) => p.canvaSlotRef?.slotId)).toEqual([
      page.slots[0]!.id,
      page.slots[1]!.id,
      page.slots[2]!.id,
      page.slots[3]!.id,
      page.slots[4]!.id,
      page.slots[5]!.id,
      page.slots[6]!.id,
      page.slots[7]!.id,
      page.slots[8]!.id,
      page.slots[9]!.id,
      page.slots[10]!.id,
      page.slots[11]!.id,
    ]);
  });

  it("prioriza ordem Canva mesmo com dayNumbers desalinhados (spread)", () => {
    const page = makePageWithImages("page_1");
    const pages = [page];
    const reversed = true;
    const items = canvaSlotsToScheduleItems(pages, reversed);

    const posts = items.map((item, i) => ({
      id: `post_day${i + 1}`,
      dayNumber: i + 1,
      dateLabel: "",
      image: item.image,
      imageAssetId: null,
      matchedCatalogId: null,
      canvaSlotRef: item.canvaSlotRef ?? null,
      reasoning: null,
      caption: "",
      isGenerating: false,
      isGenerated: false,
      isConfirmed: false,
      error: null,
    }));

    const ordered = sortPostsForInstagramProfile(posts, {
      canvaPages: pages,
      canvaGridReversed: reversed,
    });

    expect(ordered[0]?.canvaSlotRef?.slotId).toBe(page.slots[0]!.id);
    expect(ordered[ordered.length - 1]?.canvaSlotRef?.slotId).toBe(page.slots[11]!.id);
  });

  it("sem Canva, ordena por dayNumber desc e slot no dia", () => {
    const posts = [
      {
        id: "post_day5_p1",
        dayNumber: 5,
        dateLabel: "",
        image: "a",
        imageAssetId: null,
        matchedCatalogId: null,
        reasoning: null,
        caption: "",
        isGenerating: false,
        isGenerated: false,
        isConfirmed: false,
        error: null,
      },
      {
        id: "post_day5",
        dayNumber: 5,
        dateLabel: "",
        image: "b",
        imageAssetId: null,
        matchedCatalogId: null,
        reasoning: null,
        caption: "",
        isGenerating: false,
        isGenerated: false,
        isConfirmed: false,
        error: null,
      },
      {
        id: "post_day10",
        dayNumber: 10,
        dateLabel: "",
        image: "c",
        imageAssetId: null,
        matchedCatalogId: null,
        reasoning: null,
        caption: "",
        isGenerating: false,
        isGenerated: false,
        isConfirmed: false,
        error: null,
      },
    ];

    const ordered = sortPostsForInstagramProfile(posts);
    expect(ordered.map((p) => p.id)).toEqual(["post_day10", "post_day5_p1", "post_day5"]);
  });
});
