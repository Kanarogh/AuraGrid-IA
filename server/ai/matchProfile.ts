/** Compacta perfis v2 para match — chaves curtas, economia de tokens. */

import { compactProfileForMatchJson } from "./catalogProfileV2";

export function compactProfileForMatch(
  id: string,
  label: string,
  profile: Record<string, unknown> | undefined
): Record<string, unknown> {
  return compactProfileForMatchJson(id, label, profile);
}

/** Alias — provedores com limite apertado usam o mesmo JSON mínimo v2. */
export function ultraCompactProfileForMatch(
  id: string,
  label: string,
  profile: Record<string, unknown> | undefined
): Record<string, unknown> {
  return compactProfileForMatchJson(id, label, profile);
}

export function buildStrictMatchingRubric(): string {
  return `STRICT MATCHING PROTOCOL — compact JSON (g=garment, sc=scene):

PHASE 1 — POST IMAGE:
- g.m (motif) + g.b (back) + g.l (layout) are deciding fields
- g.c (colors) must be specific shades
- sc (scene) is for caption context only — NEVER match SKU by background alone

PHASE 2 — SCORE (0–100):
+18  g.m motif match
+8   g.l layout match
+14  g.b back + g.n neck
+15  g.c colors (specific shades)
+12  g.len length
+8   g.s sleeve, g.sil silhouette
+16  g.a anchors confirmed (max +16, +2 each)
−25  anchor contradicted
−28  g.not tokens describe the post BETTER than this candidate
−22  motif type clash (tie-dye vs geometric)

PHASE 3 — DECISION:
- matchedId only if score ≥82, gap ≥20 (≥86/≥22 with similar siblings)
- pattern/back must match — color alone NEVER enough
- matchedId null when uncertain`;
}
