import type { PostVisualFingerprint } from "./postFingerprint";

export type RankableCatalogProfile = {
  id: string;
  label: string;
  profile?: Record<string, unknown>;
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
  return haystack.includes(needle) || needle.includes(haystack);
}

function scoreColors(fp: PostVisualFingerprint, profile: Record<string, unknown>): number {
  let score = 0;
  const fpColors = [
    norm(fp.dominantColorFamily),
    ...(fp.primaryColors ?? []).map(norm),
  ].filter(Boolean);
  const profileColors = [
    norm(profile.dominantColorFamily),
    ...asStrings(profile.primaryColors).map(norm),
    ...asStrings(profile.secondaryColors).map(norm),
  ].filter(Boolean);

  for (const fpColor of fpColors) {
    if (profileColors.some((pc) => includesLoose(pc, fpColor) || includesLoose(fpColor, pc))) {
      score += 15;
      break;
    }
  }
  return score;
}

function scoreField(fpValue: string | undefined, profileValue: unknown, weight: number): number {
  const a = norm(fpValue);
  const b = norm(profileValue);
  if (!a || !b || a === "unknown" || b === "unknown") return 0;
  if (a === b || includesLoose(a, b) || includesLoose(b, a)) return weight;
  return 0;
}

function scorePattern(fp: PostVisualFingerprint, profile: Record<string, unknown>): number {
  const fpPattern = norm(fp.patternType);
  const profilePattern =
    typeof profile.pattern === "object" && profile.pattern
      ? norm((profile.pattern as { type?: string }).type)
      : norm(profile.pattern);

  if (!fpPattern || fpPattern === "unknown") return 0;
  if (fpPattern === profilePattern || includesLoose(fpPattern, profilePattern)) {
    let score = 15;
    const fpScale = norm(fp.printScale);
    const profileScale = norm(profile.printScale);
    if (fpScale && profileScale && (fpScale === profileScale || includesLoose(fpScale, profileScale))) {
      score += 5;
    }
    return score;
  }
  return 0;
}

function scoreAnchors(fp: PostVisualFingerprint, profile: Record<string, unknown>): number {
  const anchors = [
    ...asStrings(profile.matchAnchors),
    ...asStrings(profile.distinctiveDetails),
    ...asStrings(profile.matchKeywords),
  ].map(norm);
  const visible = (fp.visibleAnchors ?? []).map(norm);
  if (!anchors.length || !visible.length) return 0;

  let matched = 0;
  for (const anchor of anchors) {
    if (visible.some((v) => includesLoose(v, anchor) || includesLoose(anchor, v))) {
      matched += 1;
    }
  }
  return Math.min(10, matched * 2);
}

export function scoreCatalogProfile(
  fingerprint: PostVisualFingerprint,
  profile: Record<string, unknown> | undefined
): number {
  const p = profile ?? {};
  let score = 0;

  score += scoreField(fingerprint.garmentType, p.garmentType ?? p.category, 12);
  score += scoreColors(fingerprint, p);
  score += scorePattern(fingerprint, p);
  score += scoreField(fingerprint.neckline, p.neckline, 12);
  score += scoreField(fingerprint.sleeves, p.sleeveType ?? p.sleeves, 10);
  score += scoreField(
    fingerprint.dressLength,
    p.lengthCategory ?? p.dressLength,
    12
  );
  score += scoreField(fingerprint.silhouette, p.silhouette, 10);
  score += scoreAnchors(fingerprint, p);

  return score;
}

export function rankCatalogProfiles(
  fingerprint: PostVisualFingerprint,
  profiles: RankableCatalogProfile[],
  topK: number
): {
  ranked: RankableCatalogProfile[];
  scores: Map<string, number>;
  topHint: {
    candidateId: string;
    candidateLabel: string;
    score: number;
    scoreGap: number;
  } | null;
} {
  const scored = profiles.map((item) => ({
    item,
    score: scoreCatalogProfile(fingerprint, item.profile),
  }));

  scored.sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label));

  const scores = new Map(scored.map((s) => [s.item.id, s.score]));
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

  return { ranked, scores, topHint };
}
