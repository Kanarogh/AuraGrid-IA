/**
 * Testes scoreTemp no ranker.
 * Rodar: npx tsx server/ai/profileRankerTemp.test.ts
 */
import assert from "node:assert/strict";
import { scoreCatalogProfile } from "./profileRanker";
import type { PostVisualFingerprint } from "./postFingerprint";

const fp: PostVisualFingerprint = {
  garmentType: "dress",
  dominantColorFamily: "coral",
  garment: { temp: "warm" },
};

const warmMatch = scoreCatalogProfile(fp, {
  version: 2,
  garment: { type: "dress", colors: ["coral"], temp: "warm", motif: "solid", anchors: ["a", "b", "c"] },
  scene: { setting: "studio", tags: [] },
});

const coolClash = scoreCatalogProfile(fp, {
  version: 2,
  garment: { type: "dress", colors: ["coral"], temp: "cool", motif: "solid", anchors: ["a", "b", "c"] },
  scene: { setting: "studio", tags: [] },
});

assert.ok(warmMatch > coolClash, "temp warm vs cool deve penalizar clash");

console.log("profileRankerTemp.test.ts — OK");
