import { runVisionWithFallback } from "./fallbackChain";
import {
  MATCH_SHORTLIST_THRESHOLD,
  MATCH_SHORTLIST_TOP_K,
  OLLAMA_MATCH_SHORTLIST_THRESHOLD,
  OLLAMA_MATCH_SHORTLIST_TOP_K,
  STRICT_RANKER_MIN_GAP,
  STRICT_RANKER_MIN_SCORE,
  type CatalogProfilePayload,
} from "./operations";
import type { MatchGenerateInput, MatchGenerateResult, AiProviderId, MatchRankHint } from "./types";

export type MatchShortlistMeta = {
  total: number;
  selected: number;
  topScore: number;
  usedFingerprint: boolean;
  topCandidateId?: string;
};

export type PreparedMatchInput = {
  input: MatchGenerateInput;
  shortlist?: MatchShortlistMeta;
  matchRankHint?: MatchRankHint | null;
};

export async function prepareMatchInput(
  sanitized: MatchGenerateInput,
  providerId: AiProviderId
): Promise<PreparedMatchInput> {
  if (sanitized.captionFromImageOnly) {
    return { input: sanitized };
  }

  const profiles = sanitized.catalogProfiles;
  if (!profiles?.length) {
    return { input: sanitized };
  }

  const threshold =
    providerId === "ollama" ? OLLAMA_MATCH_SHORTLIST_THRESHOLD : MATCH_SHORTLIST_THRESHOLD;
  const topK = providerId === "ollama" ? OLLAMA_MATCH_SHORTLIST_TOP_K : MATCH_SHORTLIST_TOP_K;

  if (profiles.length <= threshold) {
    return {
      input: sanitized,
      shortlist: {
        total: profiles.length,
        selected: profiles.length,
        topScore: 0,
        usedFingerprint: false,
      },
    };
  }

  return shortlistProfiles(sanitized, profiles, providerId);
}

async function shortlistProfiles(
  sanitized: MatchGenerateInput,
  profiles: CatalogProfilePayload[],
  providerId: AiProviderId
): Promise<PreparedMatchInput> {
  const topK = providerId === "ollama" ? OLLAMA_MATCH_SHORTLIST_TOP_K : MATCH_SHORTLIST_TOP_K;

  try {
    const fingerprintOutcome = await runVisionWithFallback(
      "post-fingerprint",
      (provider) => provider.analyzePostVisual({ postImage: sanitized.postImage }),
      providerId
    );

    const { rankCatalogProfiles } = await import("./profileRanker");
    const fingerprint = fingerprintOutcome.result;
    const { ranked, scores, topHint } = rankCatalogProfiles(fingerprint, profiles, topK);

    const topScore = Math.max(0, ...Array.from(scores.values()));

    console.info(
      `[match-pipeline] shortlist ${ranked.length}/${profiles.length} perfis (topScore=${topScore}${topHint ? `, top=${topHint.candidateId}` : ""})`
    );

    return {
      input: {
        ...sanitized,
        catalogProfiles: ranked,
        matchRankHint: topHint ?? undefined,
      },
      shortlist: {
        total: profiles.length,
        selected: ranked.length,
        topScore,
        usedFingerprint: true,
        topCandidateId: topHint?.candidateId,
      },
      matchRankHint: topHint,
    };
  } catch (error) {
    console.warn("[match-pipeline] fingerprint falhou — usando top perfis compactos:", error);
    const fallback = profiles.slice(0, topK);
    return {
      input: {
        ...sanitized,
        catalogProfiles: fallback,
      },
      shortlist: {
        total: profiles.length,
        selected: fallback.length,
        topScore: 0,
        usedFingerprint: false,
      },
    };
  }
}

/** Se a IA retornou matchedId null mas o ranker visual passou no protocolo estrito (≥78, gap ≥15). */
export function applyStrictRankerMatchFallback(
  result: MatchGenerateResult,
  hint: MatchRankHint | null | undefined,
  candidates: CatalogProfilePayload[]
): MatchGenerateResult {
  if (result.matchedId || !hint) return result;
  if (hint.score < STRICT_RANKER_MIN_SCORE || hint.scoreGap < STRICT_RANKER_MIN_GAP) {
    return result;
  }
  if (!candidates.some((c) => c.id === hint.candidateId)) return result;

  console.info(
    `[match-pipeline] matchedId strict ranker → ${hint.candidateId} (score=${hint.score}, gap=${hint.scoreGap})`
  );

  return {
    ...result,
    matchedId: hint.candidateId,
    reasoning: result.reasoning
      ? `${result.reasoning}\n\n[Match visual] Referência "${hint.candidateLabel}" (score ${hint.score}, gap ${hint.scoreGap}, protocolo estrito).`
      : `[Match visual] Referência "${hint.candidateLabel}" (score ${hint.score}, gap ${hint.scoreGap}).`,
    matchMode:
      result.matchMode === "catalog_json" || result.matchMode === "catalog_json_shortlist"
        ? "catalog_json_ranker"
        : result.matchMode,
  };
}

export function applyShortlistToResult(
  result: MatchGenerateResult,
  shortlist?: MatchShortlistMeta
): MatchGenerateResult {
  if (!shortlist || shortlist.selected >= shortlist.total) {
    return result;
  }
  return {
    ...result,
    matchMode: result.matchMode === "catalog_json" ? "catalog_json_shortlist" : result.matchMode,
  };
}

export function shortlistHeaderValue(shortlist?: MatchShortlistMeta): string | null {
  if (!shortlist) return null;
  return `${shortlist.selected}/${shortlist.total}${shortlist.usedFingerprint ? "+fp" : ""}`;
}
