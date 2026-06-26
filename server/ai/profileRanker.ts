import { flattenProfileForRanker, type FlatGarmentView } from "./catalogProfileV2";
import type { PostVisualFingerprint } from "./postFingerprint";

export type RankableCatalogProfile = {
  id: string;
  label: string;
  profile?: Record<string, unknown>;
};

export type ProfileMatchScore = {
  total: number;
  pattern: number;
  anchors: number;
  penalty: number;
};

function norm(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase().trim() : "";
}

function asStrings(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  }
  return [];
}

function includesLoose(haystack: string, needle: string): boolean {
  if (!haystack || !needle) return false;
  if (haystack.includes(needle) || needle.includes(haystack)) return true;
  const hayTokens = haystack.split(/[\s,/|-]+/).filter((t) => t.length > 3);
  const needleTokens = needle.split(/[\s,/|-]+/).filter((t) => t.length > 3);
  return needleTokens.some((nt) => hayTokens.some((ht) => ht.includes(nt) || nt.includes(ht)));
}

const GENERIC_COLOR_WORDS = new Set([
  "blue",
  "azul",
  "green",
  "verde",
  "red",
  "vermelho",
  "pink",
  "rosa",
  "yellow",
  "amarelo",
  "white",
  "branco",
  "black",
  "preto",
  "multicolor",
  "colorido",
]);

function isGenericColor(value: string): boolean {
  const t = norm(value);
  return GENERIC_COLOR_WORDS.has(t) || t.length < 4;
}

function scoreColors(fp: PostVisualFingerprint, profile: Record<string, unknown>): number {
  const fpColors = [
    norm(fp.dominantColorFamily),
    ...(fp.primaryColors ?? []).map(norm),
  ].filter(Boolean);
  const profileColors = [
    norm(profile.dominantColorFamily),
    ...asStrings(profile.primaryColors).map(norm),
    ...asStrings(profile.secondaryColors).map(norm),
  ].filter(Boolean);

  if (!fpColors.length || !profileColors.length) return 0;

  let best = 0;
  for (const fpColor of fpColors) {
    for (const pc of profileColors) {
      if (fpColor === pc) {
        best = Math.max(best, 15);
      } else if (includesLoose(pc, fpColor) && !isGenericColor(fpColor) && !isGenericColor(pc)) {
        best = Math.max(best, 12);
      } else if (includesLoose(pc, fpColor)) {
        best = Math.max(best, 5);
      }
    }
  }
  return best;
}

function scoreField(fpValue: string | undefined, profileValue: unknown, weight: number): number {
  const a = norm(fpValue);
  const b = norm(profileValue);
  if (!a || !b || a === "unknown" || b === "unknown") return 0;
  if (a === b || includesLoose(a, b) || includesLoose(b, a)) return weight;
  return 0;
}

function patternDescription(profile: Record<string, unknown>): string {
  const pat = profile.pattern;
  if (typeof pat === "object" && pat && !Array.isArray(pat)) {
    const desc = norm((pat as { description?: string }).description);
    const type = norm((pat as { type?: string }).type);
    return [type, desc].filter(Boolean).join(" ");
  }
  return norm(pat);
}

function profilePatternMotif(profile: Record<string, unknown>): string {
  return [
    norm(profile.patternMotif),
    patternDescription(profile),
    norm(profile.distinguishingFingerprint),
  ]
    .filter(Boolean)
    .join(" ");
}

function scorePattern(fp: PostVisualFingerprint, profile: Record<string, unknown>): number {
  let score = 0;

  const fpMotif = [norm(fp.patternMotif), norm(fp.patternType)].filter(Boolean).join(" ");
  const profileMotif = profilePatternMotif(profile);

  if (fpMotif && profileMotif) {
    if (fpMotif === profileMotif || includesLoose(profileMotif, fpMotif)) {
      score += 18;
    } else {
      const fpTokens = fpMotif.split(/[\s,/|-]+/).filter((t) => t.length > 4);
      const matchedTokens = fpTokens.filter((t) => includesLoose(profileMotif, t)).length;
      if (matchedTokens >= 3) score += 14;
      else if (matchedTokens >= 2) score += 8;
      else if (matchedTokens >= 1) score += 3;
    }
  }

  const fpPattern = norm(fp.patternType);
  const profilePattern =
    typeof profile.pattern === "object" && profile.pattern
      ? norm((profile.pattern as { type?: string }).type)
      : norm(profile.pattern);

  if (fpPattern && profilePattern) {
    if (fpPattern === profilePattern || includesLoose(fpPattern, profilePattern)) {
      score += 6;
    } else {
      score -= 12;
    }
  }

  score += scoreField(fp.patternLayout, profile.patternLayout, 8);

  const fpScale = norm(fp.printScale);
  const profileScale = norm(profile.printScale);
  if (fpScale && profileScale && (fpScale === profileScale || includesLoose(fpScale, profileScale))) {
    score += 4;
  }

  return score;
}

function scoreBackAndConstruction(
  fp: PostVisualFingerprint,
  profile: Record<string, unknown>
): number {
  let score = 0;
  score += scoreField(fp.backDetail, profile.backDetail, 14);
  score += scoreField(fp.neckline, profile.neckline, 10);
  score += scoreField(fp.skirtConstruction, profile.skirtConstruction, 8);
  return score;
}

function scoreAnchors(fp: PostVisualFingerprint, profile: Record<string, unknown>): number {
  const anchors = [
    ...asStrings(profile.matchAnchors),
    ...asStrings(profile.distinctiveDetails),
    ...asStrings(profile.matchKeywords),
    norm(profile.distinguishingFingerprint),
  ]
    .map(norm)
    .filter(Boolean);

  const visible = [
    ...(fp.visibleAnchors ?? []).map(norm),
    norm(fp.patternMotif),
    norm(fp.backDetail),
    norm(fp.patternLayout),
    norm(fp.skirtConstruction),
  ].filter(Boolean);

  if (!anchors.length || !visible.length) return 0;

  let matched = 0;
  for (const anchor of anchors) {
    if (visible.some((v) => includesLoose(v, anchor) || includesLoose(anchor, v))) {
      matched += 1;
    }
  }
  return Math.min(16, matched * 2);
}

function scoreContradictionPenalty(
  fp: PostVisualFingerprint,
  profile: Record<string, unknown>
): number {
  let penalty = 0;
  const visible = (fp.visibleAnchors ?? []).map(norm).join(" ");
  const notToConfuse = norm(profile.notToConfuseWith);

  if (notToConfuse && visible) {
    const confusionTokens = notToConfuse.split(/[\s,.]+/).filter((t) => t.length > 5);
    const hits = confusionTokens.filter((t) => includesLoose(visible, t)).length;
    if (hits >= 3) penalty += 28;
    else if (hits >= 2) penalty += 18;
  }

  const fpMotif = norm(fp.patternMotif);
  const profileMotif = profilePatternMotif(profile);
  if (fpMotif && profileMotif) {
    const contradictoryPairs: [RegExp, RegExp][] = [
      [/tie.?dye|faixa|horizontal band/i, /geometric|medallion|simetr|symmetr|estampa/i],
      [/geometric|medallion|simetr/i, /tie.?dye|faixa horizontal/i],
      [/solid|liso/i, /floral|estampa|print|pattern/i],
    ];
    for (const [fpPat, profPat] of contradictoryPairs) {
      if (fpPat.test(fpMotif) && profPat.test(profileMotif)) penalty += 22;
      if (profPat.test(fpMotif) && fpPat.test(profileMotif)) penalty += 22;
    }
  }

  return penalty;
}

function scoreSceneBonus(fp: PostVisualFingerprint, flat: FlatGarmentView): number {
  const fpScene = fp.scene;
  const catScene = flat.scene;
  if (!fpScene?.setting || !catScene?.setting) return 0;
  if (catScene.setting === "studio") return 0;
  let bonus = 0;
  if (fpScene.setting === catScene.setting) bonus += 2;
  const fpTags = (fpScene.tags ?? []).map(norm);
  const catTags = (catScene.tags ?? []).map(norm);
  const tagHits = fpTags.filter((t) => catTags.some((c) => includesLoose(c, t))).length;
  if (tagHits >= 2) bonus += 2;
  return Math.min(4, bonus);
}

function scoreNotTokens(fp: PostVisualFingerprint, flat: FlatGarmentView): number {
  const visible = [
    ...(fp.visibleAnchors ?? []).map(norm),
    norm(fp.patternMotif),
    norm(fp.backDetail),
  ]
    .filter(Boolean)
    .join(" ");
  const notRaw = flat.notToConfuseWith ?? "";
  const notTokens = notRaw.split(/[\s,]+/).filter((t) => t.length > 4);
  if (!visible || notTokens.length === 0) return 0;
  const hits = notTokens.filter((t) => includesLoose(visible, t)).length;
  if (hits >= 3) return 28;
  if (hits >= 2) return 18;
  return 0;
}

export function scoreCatalogProfileDetailed(
  fingerprint: PostVisualFingerprint,
  profile: Record<string, unknown> | undefined
): ProfileMatchScore {
  const p = flattenProfileForRanker(profile);
  let total = 0;

  total += scoreField(fingerprint.garmentType, p.garmentType, 10);
  total += scoreColors(fingerprint, p);

  const pattern = scorePattern(fingerprint, p);
  total += pattern;

  total += scoreBackAndConstruction(fingerprint, p);
  total += scoreField(fingerprint.sleeves, p.sleeveType ?? p.sleeves, 8);
  total += scoreField(fingerprint.dressLength, p.lengthCategory ?? p.dressLength, 10);
  total += scoreField(fingerprint.silhouette, p.silhouette, 8);

  const anchors = scoreAnchors(fingerprint, p);
  total += anchors;

  total += scoreSceneBonus(fingerprint, p);

  let penalty = scoreContradictionPenalty(fingerprint, p);
  penalty += scoreNotTokens(fingerprint, p);
  total -= penalty;

  return {
    total: Math.max(0, total),
    pattern,
    anchors,
    penalty,
  };
}

export function scoreCatalogProfile(
  fingerprint: PostVisualFingerprint,
  profile: Record<string, unknown> | undefined
): number {
  return scoreCatalogProfileDetailed(fingerprint, profile).total;
}

export function rankCatalogProfiles(
  fingerprint: PostVisualFingerprint,
  profiles: RankableCatalogProfile[],
  topK: number
): {
  ranked: RankableCatalogProfile[];
  scores: Map<string, number>;
  detailedScores: Map<string, ProfileMatchScore>;
  topHint: {
    candidateId: string;
    candidateLabel: string;
    score: number;
    scoreGap: number;
  } | null;
} {
  const scored = profiles.map((item) => {
    const detailed = scoreCatalogProfileDetailed(fingerprint, item.profile);
    return { item, score: detailed.total, detailed };
  });

  scored.sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label));

  const scores = new Map(scored.map((s) => [s.item.id, s.score]));
  const detailedScores = new Map(scored.map((s) => [s.item.id, s.detailed]));
  const ranked = scored.slice(0, topK).map((s) => s.item);
  const top = scored[0];
  const second = scored[1];
  const topHint =
    top && top.score > 0
      ? {
          candidateId: top.item.id,
          candidateLabel: top.item.label,
          score: top.score,
          scoreGap: top.score - (second?.score ?? 0),
        }
      : null;

  return { ranked, scores, detailedScores, topHint };
}

/** Detecta variantes irmãs (mesma família de cor/tipo) no shortlist. */
export function countSimilarSiblings(
  profiles: RankableCatalogProfile[]
): number {
  const buckets = new Map<string, number>();
  for (const item of profiles) {
    const p = flattenProfileForRanker(item.profile);
    const key = [
      norm(p.garmentType),
      norm(p.dominantColorFamily).split(/[-\s]+/).slice(0, 2).join(" "),
      norm(p.lengthCategory ?? p.dressLength),
    ].join("|");
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return Math.max(0, ...Array.from(buckets.values(), (n) => (n >= 2 ? n : 0)));
}
