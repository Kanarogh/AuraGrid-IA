/** Compacta perfis indexados para match — só campos discriminativos. */

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

export function compactProfileForMatch(
  id: string,
  label: string,
  profile: Record<string, unknown> | undefined
): Record<string, unknown> {
  const p = profile ?? {};
  const anchors = asStringArray(p.matchAnchors);
  const fallbackAnchors =
    anchors.length > 0
      ? anchors
      : [
          ...asStringArray(p.distinctiveDetails),
          ...asStringArray(p.embellishments),
          ...asStringArray(p.matchKeywords),
        ].slice(0, 8);

  const primary = asStringArray(p.primaryColors);

  return {
    id,
    label,
    referenceLabel: p.referenceLabel ?? label,
    garmentType: p.garmentType,
    category: p.category,
    dominantColorFamily: p.dominantColorFamily ?? primary[0] ?? null,
    colorTemperature: p.colorTemperature ?? null,
    primaryColors: primary,
    secondaryColors: asStringArray(p.secondaryColors),
    pattern: p.pattern,
    printScale: p.printScale ?? null,
    neckline: p.neckline,
    sleeves: p.sleeves,
    sleeveType: p.sleeveType ?? p.sleeves,
    dressLength: p.dressLength,
    lengthCategory: p.lengthCategory ?? p.dressLength,
    silhouette: p.silhouette,
    fabricTexture: p.fabricTexture,
    embellishments: asStringArray(p.embellishments),
    matchAnchors: fallbackAnchors,
    distinguishingFingerprint: p.distinguishingFingerprint,
    notToConfuseWith: p.notToConfuseWith ?? null,
    matchKeywords: asStringArray(p.matchKeywords),
  };
}

export function buildStrictMatchingRubric(): string {
  return `STRICT MATCHING PROTOCOL — follow every phase before setting matchedId:

PHASE 1 — OBSERVE THE POST IMAGE (mandatory mental checklist):
- Garment type (dress, top, saree, set, etc.)
- Dominant color with SPECIFIC shade (e.g. "teal-green", not just "green")
- Pattern: type, scale (micro/small/medium/large/all-over), and main motifs
- Neckline shape, sleeve type/length, dress length (mini/midi/maxi/floor)
- Silhouette (A-line, fitted, flowy, empire waist, etc.)
- Fabric drape/texture, embellishments, unique details visible in the photo

PHASE 2 — SCORE EACH CANDIDATE (0–100, be conservative):
+15  primaryColors / dominantColorFamily match the observed dominant shade
+15  pattern.type AND printScale match (solid vs floral size matters)
+12  dressLength AND lengthCategory match
+12  neckline matches (V, round, halter, square, off-shoulder, etc.)
+10  sleeves / sleeveType match
+10  silhouette matches
+10  fabricTexture plausible for what is visible
+8   visible embellishments align with profile
+10  matchAnchors: +2 per anchor clearly confirmed in the post (max +10)
−25  any matchAnchor visibly CONTRADICTED (e.g. profile says sleeveless, post has long sleeves)
−20  notToConfuseWith better describes the post than this profile

PHASE 3 — DECISION RULES (precision over recall):
- Set matchedId ONLY if ALL are true:
  (a) highest score ≥ 78
  (b) gap between 1st and 2nd place ≥ 15 points
  (c) at least 4 matchAnchors clearly confirmed in the post image
  (d) zero contradicted anchors for the chosen candidate
- If two floral/maxi dresses score close, discriminate by EXACT color shade, print SCALE, neckline, and sleeve length — never guess.
- matchedId MUST be null when uncertain — a wrong reference is worse than no reference.
- NEVER pick based on catalog label text alone — only visual evidence from the post image.
- NEVER invent catalog ids — only ids from CANDIDATE CATALOG PROFILES.`;
}
