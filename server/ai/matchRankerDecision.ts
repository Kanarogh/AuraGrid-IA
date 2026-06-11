import {
  STRICT_RANKER_MIN_GAP,
  STRICT_RANKER_MIN_SCORE,
  type CatalogProfilePayload,
} from "./operations";
import type { PostVisualFingerprint } from "./postFingerprint";
import {
  countSimilarSiblings,
  rankCatalogProfiles,
  scoreCatalogProfileDetailed,
} from "./profileRanker";
import type { MatchRankHint } from "./types";

export const SIBLING_MIN_GAP = 22;
export const SIBLING_MIN_ANCHORS = 6;
export const SIBLING_MIN_PATTERN = 10;

export type RankerThresholds = {
  minScore: number;
  minGap: number;
  siblings: number;
};

export function getRankerThresholds(candidates: CatalogProfilePayload[]): RankerThresholds {
  const siblings = countSimilarSiblings(candidates);
  return {
    siblings,
    minGap: siblings >= 2 ? SIBLING_MIN_GAP : STRICT_RANKER_MIN_GAP,
    minScore: siblings >= 2 ? STRICT_RANKER_MIN_SCORE + 4 : STRICT_RANKER_MIN_SCORE,
  };
}

export type RankerCandidateAssessment = {
  matchedId: string;
  matchedLabel: string;
  matchedRank: number;
  matchedScore: number;
  scoreGap: number;
  matchedDetail: ReturnType<typeof scoreCatalogProfileDetailed>;
  rejectReasons: string[];
  thresholds: RankerThresholds;
};

/** Avalia se um candidato específico passa no protocolo estrito do ranker. */
export function assessRankerCandidate(
  fingerprint: PostVisualFingerprint,
  candidates: CatalogProfilePayload[],
  matchedId: string
): RankerCandidateAssessment | null {
  const matched = candidates.find((c) => c.id === matchedId);
  if (!matched) return null;

  const ranked = rankCatalogProfiles(fingerprint, candidates, candidates.length);
  const thresholds = getRankerThresholds(candidates);
  const matchedDetail = scoreCatalogProfileDetailed(fingerprint, matched.profile);
  const matchedRank = ranked.ranked.findIndex((c) => c.id === matchedId);
  const top = ranked.ranked[0];
  const second = ranked.ranked[1];
  const topScore = ranked.scores.get(top?.id ?? "") ?? 0;
  const secondScore = second ? (ranked.scores.get(second.id) ?? 0) : 0;
  const matchedScore = ranked.scores.get(matchedId) ?? matchedDetail.total;
  const scoreGap = matchedRank === 0 ? matchedScore - secondScore : topScore - matchedScore;

  const rejectReasons: string[] = [];

  if (matchedRank > 0) {
    rejectReasons.push(
      `ranker colocou outro candidato em 1º (${top?.label ?? "?"} score ${topScore} vs ${matchedScore})`
    );
  }
  if (matchedScore < thresholds.minScore) {
    rejectReasons.push(`score ${matchedScore} < mínimo ${thresholds.minScore}`);
  }
  if (scoreGap < thresholds.minGap) {
    rejectReasons.push(
      `gap ${scoreGap} < mínimo ${thresholds.minGap}${thresholds.siblings >= 2 ? " (variantes similares)" : ""}`
    );
  }
  if (thresholds.siblings >= 2) {
    if (matchedDetail.anchors < SIBLING_MIN_ANCHORS) {
      rejectReasons.push(
        `âncoras confirmadas ${matchedDetail.anchors} < ${SIBLING_MIN_ANCHORS} para variantes similares`
      );
    }
    if (matchedDetail.pattern < SIBLING_MIN_PATTERN) {
      rejectReasons.push(
        `padrão/estampa ${matchedDetail.pattern} < ${SIBLING_MIN_PATTERN} — motivo visual não bate`
      );
    }
    if (matchedDetail.penalty >= 18) {
      rejectReasons.push(`penalidade de contradição ${matchedDetail.penalty}`);
    }
  }

  return {
    matchedId,
    matchedLabel: matched.label,
    matchedRank,
    matchedScore,
    scoreGap,
    matchedDetail,
    rejectReasons,
    thresholds,
  };
}

export type RankerMatchEvaluation = {
  confident: boolean;
  matchedId: string | null;
  candidateLabel: string | null;
  reasoning: string;
  score: number;
  scoreGap: number;
};

/** Decide se o ranker pode fechar o match sem LLM de visão. */
export function evaluateRankerMatch(
  fingerprint: PostVisualFingerprint,
  candidates: CatalogProfilePayload[],
  topHint?: MatchRankHint | null
): RankerMatchEvaluation {
  const ranked = rankCatalogProfiles(fingerprint, candidates, candidates.length);
  const hint = topHint ?? ranked.topHint;

  if (!hint || hint.score <= 0) {
    return {
      confident: false,
      matchedId: null,
      candidateLabel: null,
      reasoning: "[Ranker] Sem candidato com score positivo.",
      score: 0,
      scoreGap: 0,
    };
  }

  const assessment = assessRankerCandidate(fingerprint, candidates, hint.candidateId);
  if (!assessment) {
    return {
      confident: false,
      matchedId: null,
      candidateLabel: null,
      reasoning: "[Ranker] Candidato top não encontrado na lista.",
      score: hint.score,
      scoreGap: hint.scoreGap,
    };
  }

  if (assessment.rejectReasons.length > 0) {
    return {
      confident: false,
      matchedId: null,
      candidateLabel: assessment.matchedLabel,
      reasoning: `[Ranker] Match incerto — ${assessment.rejectReasons.join("; ")}.`,
      score: assessment.matchedScore,
      scoreGap: assessment.scoreGap,
    };
  }

  return {
    confident: true,
    matchedId: assessment.matchedId,
    candidateLabel: assessment.matchedLabel,
    reasoning: `[Match visual] Referência "${assessment.matchedLabel}" (score ${assessment.matchedScore}, gap ${assessment.scoreGap}, ranker fast path).`,
    score: assessment.matchedScore,
    scoreGap: assessment.scoreGap,
  };
}
