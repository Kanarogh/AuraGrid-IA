/**
 * Testes de coerência e ranker pós-indexação profunda.
 * Rodar: npx tsx server/ai/catalogProfileCoherence.test.ts
 */
import assert from "node:assert/strict";
import {
  assessProfileReadiness,
  coerceCatalogProfile,
  mergeCatalogSelfCritique,
  validateProfileCoherence,
  compactProfileForMatchJson,
} from "./catalogProfileV2";
import { scoreCatalogProfileDetailed } from "./profileRanker";
import type { PostVisualFingerprint } from "./postFingerprint";

const baseProfile = coerceCatalogProfile(
  {
    version: 2,
    garment: {
      type: "dress",
      colors: ["coral-pink"],
      temp: "warm",
      motif: "solid",
      anchors: ["floral-print", "v-neck", "midi-length"],
      back: "open-cross",
    },
    scene: { setting: "studio", tags: ["white-bg"] },
  },
  "SKU-1"
);

const solidCoherence = validateProfileCoherence(baseProfile);
assert.ok(
  !solidCoherence.profile.garment.anchors?.some((a) => /floral/i.test(a)),
  "motif solid remove anchors de estampa"
);

const miniConflict = validateProfileCoherence(
  coerceCatalogProfile(
    {
      version: 2,
      garment: {
        type: "dress",
        colors: ["blue"],
        motif: "geometric",
        len: "mini",
        anchors: ["geometric-medallion", "maxi-length", "v-neck", "tiered"],
      },
      scene: { setting: "studio", tags: [] },
    },
    "SKU-2"
  )
);
assert.ok(
  !miniConflict.profile.garment.anchors?.some((a) => /maxi/i.test(a)),
  "len mini remove anchors de maxi"
);

const emptyColors = assessProfileReadiness(
  coerceCatalogProfile(
    {
      version: 2,
      garment: { type: "dress", motif: "floral", anchors: ["a", "b", "c"] },
      scene: { setting: "studio", tags: [] },
    },
    "SKU-3"
  )
);
assert.equal(emptyColors, "ready_limited", "sem cores → ready_limited");

const limitedAnchors = assessProfileReadiness(
  coerceCatalogProfile(
    {
      version: 2,
      garment: {
        type: "dress",
        colors: ["pink"],
        motif: "floral",
        anchors: ["back-not-visible", "floral-ditsy"],
      },
      scene: { setting: "studio", tags: [] },
    },
    "SKU-4"
  )
);
assert.equal(limitedAnchors, "ready_limited", "<3 anchors observáveis → ready_limited");

const merged = mergeCatalogSelfCritique(baseProfile, {
  removeAnchors: ["floral-print"],
  fieldVisibility: { back: "not-visible" },
  patches: { back: "back-not-visible" },
});
assert.equal(merged.garment.fieldVisibility?.back, "not-visible");

const compact = compactProfileForMatchJson("x", "Label", merged as unknown as Record<string, unknown>);
const g = compact.g as Record<string, unknown>;
assert.ok(g.tmp !== undefined, "compact inclui temp");
assert.ok(g.sc !== undefined || g.sk !== undefined || g.sil !== undefined || g.tmp !== undefined);

const fp: PostVisualFingerprint = {
  garmentType: "dress",
  dominantColorFamily: "coral-pink",
  backDetail: "open-cross",
  visibleAnchors: ["open-cross", "v-neck"],
  garment: { temp: "warm" },
};

const withBackVisible = scoreCatalogProfileDetailed(fp, {
  version: 2,
  garment: {
    type: "dress",
    colors: ["coral-pink"],
    temp: "warm",
    back: "open-cross",
    anchors: ["open-cross", "v-neck", "coral-pink"],
    fieldVisibility: { back: "visible" },
  },
  scene: { setting: "studio", tags: [] },
});

const withBackHidden = scoreCatalogProfileDetailed(fp, {
  version: 2,
  garment: {
    type: "dress",
    colors: ["coral-pink"],
    temp: "cool",
    back: "back-not-visible",
    anchors: ["v-neck", "coral-pink"],
    fieldVisibility: { back: "not-visible" },
  },
  scene: { setting: "studio", tags: [] },
});

assert.ok(
  withBackVisible.total > withBackHidden.total,
  "back not-visible não deve pontuar backDetail nem penalizar por clash de temp isolado"
);

console.log("catalogProfileCoherence.test.ts — OK");
