import { runVisionWithFallback } from "./fallbackChain";
import {
  getMatchEmbeddingTopK,
  isMatchEmbeddingEnabled,
} from "./matchConfig";
import { embedQueryImage, isGeminiEmbeddingConfigured } from "./geminiEmbeddings";
import { validateMatchDecision } from "./matchValidation";
import type { PostVisualFingerprint } from "./postFingerprint";
import {
  countCatalogEmbeddings,
  searchCatalogByEmbedding,
} from "../services/catalogService";
import { isPgvectorAvailable } from "../db/pgvector";
import {
  MATCH_SHORTLIST_THRESHOLD,
  MATCH_SHORTLIST_TOP_K,
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
  usedEmbedding?: boolean;
};

export type PreparedMatchInput = {
  input: MatchGenerateInput;
  shortlist?: MatchShortlistMeta;
  matchRankHint?: MatchRankHint | null;
  postFingerprint?: PostVisualFingerprint | null;
};

async function analyzePostFingerprint(
  postImage: string,
  providerId: AiProviderId,
  purpose: "planning" | "reference"
): Promise<PostVisualFingerprint | null> {
  try {
    const outcome = await runVisionWithFallback(
      "post-fingerprint",
      (provider) => provider.analyzePostVisual({ postImage, purpose }),
      providerId
    );
    return outcome.result;
  } catch (error) {
    console.warn("[match-pipeline] post-fingerprint falhou:", error);
    return null;
  }
}

export async function prepareMatchInput(
  sanitized: MatchGenerateInput,
  providerId: AiProviderId,
  operation: "match-and-generate" | "match-reference"
): Promise<PreparedMatchInput> {
  if (sanitized.captionFromImageOnly) {
    return { input: sanitized };
  }

  let profiles = sanitized.catalogProfiles;
  if (!profiles?.length) {
    return { input: sanitized };
  }

  const totalBeforeEmbed = profiles.length;
  let usedEmbedding = false;

  if (
    sanitized.clientId &&
    isMatchEmbeddingEnabled() &&
    isGeminiEmbeddingConfigured() &&
    (await isPgvectorAvailable())
  ) {
    try {
      const embeddedCount = await countCatalogEmbeddings(sanitized.clientId);
      if (embeddedCount >= 3) {
        const queryVec = await embedQueryImage(sanitized.postImage);
        const topIds = await searchCatalogByEmbedding(
          sanitized.clientId,
          queryVec,
          getMatchEmbeddingTopK()
        );
        if (topIds.length >= 3) {
          const order = new Map(topIds.map((id, i) => [id, i]));
          const filtered = profiles.filter((p) => order.has(p.id));
          if (filtered.length >= 3) {
            filtered.sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999));
            profiles = filtered;
            usedEmbedding = true;
            console.info(
              `[match-pipeline] embedding shortlist ${filtered.length}/${totalBeforeEmbed}`
            );
          }
        }
      }
    } catch (error) {
      console.warn("[match-pipeline] embedding shortlist falhou:", error);
    }
  }

  const threshold = MATCH_SHORTLIST_THRESHOLD;
  const topK = MATCH_SHORTLIST_TOP_K;

  const fingerprint = await analyzePostFingerprint(
    sanitized.postImage,
    providerId,
    operation === "match-reference" ? "reference" : "planning"
  );

  if (!fingerprint) {
    if (profiles.length <= threshold) {
      return {
        input: sanitized,
        shortlist: {
          total: totalBeforeEmbed,
          selected: profiles.length,
          topScore: 0,
          usedFingerprint: false,
          usedEmbedding,
        },
        postFingerprint: null,
      };
    }
    const fallback = profiles.slice(0, topK);
    return {
      input: { ...sanitized, catalogProfiles: fallback },
      shortlist: {
        total: totalBeforeEmbed,
        selected: fallback.length,
        topScore: 0,
        usedFingerprint: false,
        usedEmbedding,
      },
      postFingerprint: null,
    };
  }

  const { rankCatalogProfiles } = await import("./profileRanker");
  const { ranked, scores, topHint } = rankCatalogProfiles(fingerprint, profiles, topK);
  const topScore = Math.max(0, ...Array.from(scores.values()));

  if (profiles.length <= threshold) {
    console.info(
      `[match-pipeline] catÃ¡logo completo ${profiles.length} perfis (topScore=${topScore}${topHint ? `, top=${topHint.candidateId}` : ""})`
    );
    return {
      input: {
        ...sanitized,
        matchRankHint: topHint ?? undefined,
        sceneContext: fingerprint?.scene ?? undefined,
      },
      shortlist: {
        total: totalBeforeEmbed,
        selected: profiles.length,
        topScore,
        usedFingerprint: true,
        topCandidateId: topHint?.candidateId,
        usedEmbedding,
      },
      matchRankHint: topHint,
      postFingerprint: fingerprint,
    };
  }

  console.info(
    `[match-pipeline] shortlist ${ranked.length}/${profiles.length} perfis (topScore=${topScore}${topHint ? `, top=${topHint.candidateId}` : ""})`
  );

  return {
    input: {
      ...sanitized,
      catalogProfiles: ranked as CatalogProfilePayload[],
      matchRankHint: topHint ?? undefined,
      sceneContext: fingerprint?.scene ?? undefined,
    },
    shortlist: {
      total: totalBeforeEmbed,
      selected: ranked.length,
      topScore,
      usedFingerprint: true,
      topCandidateId: topHint?.candidateId,
      usedEmbedding,
    },
    matchRankHint: topHint,
    postFingerprint: fingerprint,
  };
}

/** Se a IA retornou matchedId null mas o ranker visual passou no protocolo estrito. */
export function applyStrictRankerMatchFallback(
  result: MatchGenerateResult,
  hint: MatchRankHint | null | undefined,
  candidates: CatalogProfilePayload[],
  fingerprint?: PostVisualFingerprint | null
): MatchGenerateResult {
  if (result.matchedId || !hint) return result;
  if (hint.score < STRICT_RANKER_MIN_SCORE || hint.scoreGap < STRICT_RANKER_MIN_GAP) {
    return result;
  }
  if (!candidates.some((c) => c.id === hint.candidateId)) return result;

  const fallbackResult: MatchGenerateResult = {
    ...result,
    matchedId: hint.candidateId,
    reasoning: result.reasoning
      ? `${result.reasoning}\n\n[Match visual] ReferÃªncia "${hint.candidateLabel}" (score ${hint.score}, gap ${hint.scoreGap}, protocolo estrito).`
      : `[Match visual] ReferÃªncia "${hint.candidateLabel}" (score ${hint.score}, gap ${hint.scoreGap}).`,
    matchMode:
      result.matchMode === "catalog_json" || result.matchMode === "catalog_json_shortlist"
        ? "catalog_json_ranker"
        : result.matchMode,
  };

  return validateMatchDecision(fallbackResult, fingerprint, candidates);
}

export function finalizeMatchResult(
  result: MatchGenerateResult,
  prepared: PreparedMatchInput,
  candidates: CatalogProfilePayload[]
): MatchGenerateResult {
  let finalized = applyShortlistToResult(result, prepared.shortlist);
  finalized = applyStrictRankerMatchFallback(
    finalized,
    prepared.matchRankHint,
    candidates,
    prepared.postFingerprint
  );
  finalized = validateMatchDecision(finalized, prepared.postFingerprint, candidates);
  return finalized;
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
  return `${shortlist.selected}/${shortlist.total}${shortlist.usedFingerprint ? "+fp" : ""}${shortlist.usedEmbedding ? "+emb" : ""}`;
}
