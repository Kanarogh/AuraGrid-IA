/**
 * Testes do ranker fast path — rodar: npx tsx server/ai/matchRankerDecision.test.ts
 */
import assert from "node:assert/strict";
import { evaluateRankerMatch } from "./matchRankerDecision";
import type { CatalogProfilePayload } from "./operations";
import type { PostVisualFingerprint } from "./postFingerprint";

function fp(overrides: Partial<PostVisualFingerprint> = {}): PostVisualFingerprint {
  return {
    garmentType: "dress",
    dominantColorFamily: "lime-green",
    primaryColors: ["lime-green", "teal"],
    patternMotif: "paisley-print",
    patternLayout: "all-over",
    backDetail: "open-cross",
    neckline: "v-neck",
    sleeves: "short-puff",
    dressLength: "maxi",
    visibleAnchors: ["v-neck", "paisley-print", "tiered-skirt", "open-cross", "lime-green", "teal"],
    scene: { setting: "garden", tags: ["grass", "yellow-wall"] },
    ...overrides,
  };
}

function profile(
  id: string,
  label: string,
  garment: Record<string, unknown>
): CatalogProfilePayload {
  return {
    id,
    label,
    profile: {
      version: 2,
      referenceLabel: label,
      garment,
      scene: { setting: "garden", tags: ["grass"] },
    },
  };
}

const strongMatch = profile("a", "LDR 60G", {
  type: "dress",
  colors: ["lime-green", "teal"],
  motif: "paisley-print",
  layout: "all-over",
  back: "open-cross",
  neck: "v-neck",
  sleeve: "short-puff",
  len: "maxi",
  anchors: ["v-neck", "paisley-print", "tiered-skirt", "open-cross", "lime-green", "teal"],
  not: ["tie-dye-bands"],
});

const weakSibling = profile("b", "LDR 18-A", {
  type: "dress",
  colors: ["lime-green"],
  motif: "tie-dye-horizontal",
  layout: "horizontal",
  back: "full",
  anchors: ["tie-dye", "horizontal-bands"],
});

const candidates = [strongMatch, weakSibling];

const confident = evaluateRankerMatch(fp(), candidates, {
  candidateId: "a",
  candidateLabel: "LDR 60G",
  score: 90,
  scoreGap: 30,
});

assert.equal(confident.confident, true, "deve aceitar match forte");
assert.equal(confident.matchedId, "a");

const notTopRank = evaluateRankerMatch(fp(), candidates, {
  candidateId: "b",
  candidateLabel: "LDR 18-A",
  score: 40,
  scoreGap: 5,
});

assert.equal(notTopRank.confident, false, "deve rejeitar candidato que não é 1º no ranker");

const siblingA = profile("s1", "LDR 18-A", {
  type: "dress",
  colors: ["lime-green"],
  motif: "paisley-print",
  layout: "all-over",
  anchors: ["paisley-print", "lime-green", "v-neck"],
});
const siblingB = profile("s2", "LDR 18-B", {
  type: "dress",
  colors: ["lime-green"],
  motif: "paisley-print",
  layout: "all-over",
  anchors: ["paisley-print", "lime-green", "v-neck"],
});
const siblings = [siblingA, siblingB];
const siblingEval = evaluateRankerMatch(fp(), siblings);
assert.equal(siblingEval.confident, false, "deve rejeitar empate entre variantes irmãs");

console.info("matchRankerDecision.test.ts — todos os testes passaram.");
