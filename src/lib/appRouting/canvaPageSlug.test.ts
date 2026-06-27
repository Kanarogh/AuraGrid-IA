import assert from "node:assert/strict";
import {
  canvaPageIdToUrlSlug,
  canvaPageSegmentNeedsCanonicalReplace,
  isCanvaPageUrlSlug,
  isLegacyCanvaPageSegment,
  resolveCanvaPageSegmentToId,
} from "./canvaPageSlug";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok: ${name}`);
  } catch (err) {
    console.error(`  FAIL: ${name}`);
    throw err;
  }
}

const pages = [
  { id: "page_new" },
  { id: "page_1" },
  { id: "page_2" },
];

console.log("appRouting/canvaPageSlug");

test("canvaPageIdToUrlSlug returns pagina-N by array position", () => {
  assert.equal(canvaPageIdToUrlSlug("page_1", pages), "pagina-2");
  assert.equal(canvaPageIdToUrlSlug("page_2", pages), "pagina-3");
});

test("resolveCanvaPageSegmentToId from pagina-N slug", () => {
  assert.equal(resolveCanvaPageSegmentToId(pages, "pagina-3"), "page_2");
  assert.equal(resolveCanvaPageSegmentToId(pages, "pagina-1"), "page_new");
});

test("resolveCanvaPageSegmentToId from legacy id", () => {
  assert.equal(resolveCanvaPageSegmentToId(pages, "page_2"), "page_2");
});

test("isLegacyCanvaPageSegment detects internal ids", () => {
  assert.equal(isLegacyCanvaPageSegment("page_1702397366456_tcm8"), true);
  assert.equal(isCanvaPageUrlSlug("pagina-3"), true);
  assert.equal(isLegacyCanvaPageSegment("pagina-3"), false);
});

test("canvaPageSegmentNeedsCanonicalReplace for legacy segment", () => {
  assert.equal(
    canvaPageSegmentNeedsCanonicalReplace("page_2", pages, "page_2"),
    true
  );
  assert.equal(
    canvaPageSegmentNeedsCanonicalReplace("pagina-3", pages, "page_2"),
    false
  );
});

test("resolve out-of-range pagina-N returns undefined", () => {
  assert.equal(resolveCanvaPageSegmentToId(pages, "pagina-99"), undefined);
});

console.log("All canvaPageSlug tests passed.");
