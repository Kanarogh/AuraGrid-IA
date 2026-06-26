/**
 * Diagnóstico de match enviado ao cliente — usado pela UI para mostrar
 * confiança e top candidatos (permitindo troca manual).
 */

import {
  STRICT_RANKER_MIN_GAP,
  STRICT_RANKER_MIN_SCORE,
  getMediumRankerMinGap,
  getMediumRankerMinScore,
  type CatalogProfilePayload,
} from "./operations";
import type { PreparedMatchInput } from "./matchPipeline";
import { rankCatalogProfiles, scoreCatalogProfileDetailed } from "./profileRanker";
import type { MatchGenerateResult } from "./types";

export type MatchConfidence = "high" | "medium" | "low" | "none";

export type MatchCandidateSummary = {
  id: string;
  label: string;
  score: number;
  pattern: number;
  anchors: number;
  penalty: number;
};

export type MatchDiagnostics = {
  confidence: MatchConfidence;
  chosenId: string | null;
  chosenLabel: string | null;
  chosenScore: number | null;
  scoreGap: number | null;
  topCandidates: MatchCandidateSummary[];
  rejectReasons: string[];
  /** Referência já conhecida — match visual não foi executado. */
  knownReference?: boolean;
  thresholds: {
    strict: { minScore: number; minGap: number };
    medium: { minScore: number; minGap: number };
  };
};

function classifyConfidence(
  chosenScore: number | null,
  scoreGap: number | null,
  rejectReasons: string[]
): MatchConfidence {
  if (chosenScore === null) return "none";
  if (scoreGap === null) return "low";
  if (
    chosenScore >= STRICT_RANKER_MIN_SCORE &&
    scoreGap >= STRICT_RANKER_MIN_GAP &&
    rejectReasons.length === 0
  ) {
    return "high";
  }
  const mediumScore = getMediumRankerMinScore();
  const mediumGap = getMediumRankerMinGap();
  if (chosenScore >= mediumScore && scoreGap >= mediumGap) {
    return "medium";
  }
  return "low";
}

function summarize(
  candidate: { id: string; label: string },
  fingerprintProfile: Record<string, unknown> | undefined,
  detailedFn: (id: string) => ReturnType<typeof scoreCatalogProfileDetailed> | undefined,
  scoreFromMap: number | undefined
): MatchCandidateSummary {
  const detailed = detailedFn(candidate.id);
  return {
    id: candidate.id,
    label: candidate.label,
    score: scoreFromMap ?? detailed?.total ?? 0,
    pattern: detailed?.pattern ?? 0,
    anchors: detailed?.anchors ?? 0,
    penalty: detailed?.penalty ?? 0,
  };
}

export function buildMatchDiagnostics(
  result: MatchGenerateResult,
  prepared: PreparedMatchInput,
  candidates: CatalogProfilePayload[],
  rejectReasons: string[] = []
): MatchDiagnostics {
  const thresholds = {
    strict: { minScore: STRICT_RANKER_MIN_SCORE, minGap: STRICT_RANKER_MIN_GAP },
    medium: { minScore: getMediumRankerMinScore(), minGap: getMediumRankerMinGap() },
  };

  if (result.matchMode === "catalog_known_reference") {
    const chosenCandidate = result.matchedId
      ? candidates.find((c) => c.id === result.matchedId)
      : null;
    return {
      confidence: "high",
      knownReference: true,
      chosenId: result.matchedId ?? null,
      chosenLabel: chosenCandidate?.label ?? null,
      chosenScore: null,
      scoreGap: null,
      topCandidates: [],
      rejectReasons: [],
      thresholds,
    };
  }

  const fingerprint = prepared.postFingerprint;

  if (!fingerprint || candidates.length === 0) {
    const chosenCandidate = result.matchedId
      ? candidates.find((c) => c.id === result.matchedId)
      : null;
    return {
      confidence: result.matchedId ? "low" : "none",
      chosenId: result.matchedId ?? null,
      chosenLabel: chosenCandidate?.label ?? null,
      chosenScore: null,
      scoreGap: null,
      topCandidates: [],
      rejectReasons,
      thresholds,
    };
  }

  const ranked = rankCatalogProfiles(fingerprint, candidates, candidates.length);
  const detailedFn = (id: string) => ranked.detailedScores.get(id);
  const scoreOf = (id: string) => ranked.scores.get(id) ?? 0;

  const chosenId = result.matchedId ?? null;
  const chosenCandidate = chosenId ? candidates.find((c) => c.id === chosenId) : null;
  const chosenScore = chosenId ? scoreOf(chosenId) : null;

  const topRanked = ranked.ranked.slice(0, 3);
  const topCandidates = topRanked.map((c) =>
    summarize(c, c.profile, detailedFn, scoreOf(c.id))
  );

  let scoreGap: number | null = null;
  if (chosenId && chosenScore !== null) {
    const others = topRanked.filter((c) => c.id !== chosenId);
    const runnerUpScore = others.length > 0 ? scoreOf(others[0].id) : 0;
    scoreGap = chosenScore - runnerUpScore;
  } else if (topRanked.length >= 2) {
    scoreGap = scoreOf(topRanked[0].id) - scoreOf(topRanked[1].id);
  } else if (topRanked.length === 1) {
    scoreGap = scoreOf(topRanked[0].id);
  }

  const confidence = classifyConfidence(chosenScore, scoreGap, rejectReasons);

  return {
    confidence,
    chosenId,
    chosenLabel: chosenCandidate?.label ?? null,
    chosenScore,
    scoreGap,
    topCandidates,
    rejectReasons,
    thresholds,
  };
}
