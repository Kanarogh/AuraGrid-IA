import { runVisionWithFallback, type FallbackOutcome } from "./fallbackChain";
import { getGeminiPlanningModel, getGeminiReferenceModel } from "./config";
import {
  isMatchRankerFastPathEnabled,
  isMatchTextOnlyEnabled,
  isMatchTextOnlyFallbackVisionEnabled,
  isMatchTrustVisionOnRejectEnabled,
  type MatchStrategy,
} from "./matchConfig";
import {
  finalizeMatchResult,
  prepareMatchInput,
  shortlistHeaderValue,
  type PreparedMatchInput,
} from "./matchPipeline";
import { evaluateRankerMatch, assessRankerCandidate } from "./matchRankerDecision";
import { extractMatchedGarmentDetails } from "./catalogProfileV2";
import {
  buildMatchDiagnostics,
  type MatchDiagnostics,
} from "./matchDiagnostics";
import type { AiMatchOperation, CatalogProfilePayload } from "./operations";
import type { AiProviderId, MatchGenerateInput, MatchGenerateResult } from "./types";

export type MatchOperationResult = {
  result: MatchGenerateResult;
  prepared: PreparedMatchInput;
  providerUsed: AiProviderId;
  modelUsed: string;
  strategy: MatchStrategy;
  attempts: FallbackOutcome<MatchGenerateResult>["attempts"];
  diagnostics: MatchDiagnostics;
};

function stripServerOnlyFields(input: MatchGenerateInput): MatchGenerateInput {
  const { clientId: _c, postFingerprint: _f, ...rest } = input;
  return rest;
}

async function runCaptionOnly(
  prepared: PreparedMatchInput,
  matchedId: string | null,
  providerId: AiProviderId
): Promise<{ caption: string; providerUsed: AiProviderId }> {
  const candidates = prepared.input.catalogProfiles ?? [];
  const matched = matchedId
    ? candidates.find((c) => c.id === matchedId)
    : undefined;
  const matchedLabel = matched?.label;
  const matchedGarment = matched
    ? extractMatchedGarmentDetails(matched.profile)
    : undefined;

  const outcome = await runVisionWithFallback(
    "caption-only",
    (provider) =>
      provider.generateCaptionOnly({
        postImage: prepared.input.postImage,
        brandGem: prepared.input.brandGem,
        promptContext: prepared.input.promptContext,
        repeatingText: prepared.input.repeatingText,
        sceneContext: prepared.input.sceneContext,
        matchedCatalogLabel: matchedLabel,
        matchedGarment,
        regenerateCaption: prepared.input.regenerateCaption,
        recentHooks: prepared.input.recentHooks,
      }),
    providerId
  );

  return { caption: outcome.result.caption, providerUsed: outcome.providerUsed };
}

function buildRankerFastResult(
  evaluation: ReturnType<typeof evaluateRankerMatch>,
  matchOnly: boolean
): MatchGenerateResult {
  return {
    matchedId: evaluation.matchedId,
    reasoning: evaluation.reasoning,
    caption: "",
    matchMode: "catalog_json_ranker_fast",
  };
}

export async function runMatchOperation(
  operation: AiMatchOperation,
  sanitized: MatchGenerateInput,
  providerId: AiProviderId
): Promise<MatchOperationResult> {
  const modelUsed =
    operation === "match-reference" ? getGeminiReferenceModel() : getGeminiPlanningModel();
  const matchOnly = operation === "match-reference" || !!sanitized.matchOnly;

  if (sanitized.captionFromImageOnly) {
    const outcome = await runVisionWithFallback(
      operation,
      (provider) => provider.matchAndGenerate(sanitized),
      providerId
    );
    const prepared: PreparedMatchInput = { input: sanitized };
    return {
      result: outcome.result,
      prepared,
      providerUsed: outcome.providerUsed,
      modelUsed,
      strategy: "image-only",
      attempts: outcome.attempts,
      diagnostics: buildMatchDiagnostics(outcome.result, prepared, []),
    };
  }

  const catalogCandidates = (sanitized.catalogProfiles ?? []) as CatalogProfilePayload[];
  const knownId = sanitized.knownMatchedId?.trim();
  if (
    operation === "match-and-generate" &&
    !matchOnly &&
    knownId &&
    catalogCandidates.some((c) => c.id === knownId)
  ) {
    const prepared: PreparedMatchInput = { input: sanitized };
    const { caption, providerUsed } = await runCaptionOnly(prepared, knownId, providerId);
    const result = finalizeMatchResult(
      {
        matchedId: knownId,
        reasoning:
          "Referência já identificada (nome, arquivo ou vínculo manual) — match visual omitido.",
        caption,
        matchMode: "catalog_known_reference",
      },
      prepared,
      catalogCandidates
    );
    console.info(`[match] strategy=known-reference matchedId=${knownId}`);
    return {
      result,
      prepared,
      providerUsed,
      modelUsed,
      strategy: "known-reference",
      attempts: [],
      diagnostics: buildMatchDiagnostics(result, prepared, catalogCandidates),
    };
  }

  const prepared = await prepareMatchInput(sanitized, providerId, operation);
  const candidates = (prepared.input.catalogProfiles ?? []) as CatalogProfilePayload[];
  const fingerprint = prepared.postFingerprint;

  if (
    fingerprint &&
    candidates.length > 0 &&
    isMatchRankerFastPathEnabled()
  ) {
    const evaluation = evaluateRankerMatch(
      fingerprint,
      candidates,
      prepared.matchRankHint
    );

    if (evaluation.confident && evaluation.matchedId) {
      console.info(
        `[match] strategy=ranker-fast score=${evaluation.score} gap=${evaluation.scoreGap}`
      );

      if (matchOnly) {
        const result = finalizeMatchResult(
          buildRankerFastResult(evaluation, true),
          prepared,
          candidates
        );
        return {
          result,
          prepared,
          providerUsed: providerId,
          modelUsed,
          strategy: "ranker-fast",
          attempts: [],
          diagnostics: buildMatchDiagnostics(result, prepared, candidates),
        };
      }

      const base = buildRankerFastResult(evaluation, false);
      const { caption, providerUsed } = await runCaptionOnly(
        prepared,
        evaluation.matchedId,
        providerId
      );
      const result = finalizeMatchResult(
        { ...base, caption },
        prepared,
        candidates
      );
      return {
        result,
        prepared,
        providerUsed,
        modelUsed,
        strategy: "ranker-fast",
        attempts: [],
        diagnostics: buildMatchDiagnostics(result, prepared, candidates),
      };
    }
  }

  if (
    fingerprint &&
    candidates.length > 0 &&
    isMatchTextOnlyEnabled()
  ) {
    const providerInput = stripServerOnlyFields({
      ...prepared.input,
      postFingerprint: fingerprint,
    });

    try {
      const outcome = await runVisionWithFallback(
        "match-fingerprint-text",
        (provider) =>
          provider.matchFromFingerprint({
            ...providerInput,
            postFingerprint: fingerprint,
          }),
        providerId
      );

      let result = outcome.result;
      if (result.matchMode === "catalog_json") {
        result = { ...result, matchMode: "catalog_json_fingerprint_text" };
      }

      if (!matchOnly && result.matchedId && !result.caption?.trim()) {
        const { caption, providerUsed } = await runCaptionOnly(
          prepared,
          result.matchedId,
          outcome.providerUsed
        );
        result = { ...result, caption };
        outcome.providerUsed = providerUsed;
      }

      result = finalizeMatchResult(result, prepared, candidates);

      if (
        result.matchedId ||
        (!matchOnly && !!result.caption?.trim()) ||
        !isMatchTextOnlyFallbackVisionEnabled()
      ) {
        console.info(`[match] strategy=text-only matchedId=${result.matchedId ?? "null"}`);
        return {
          result,
          prepared,
          providerUsed: outcome.providerUsed,
          modelUsed,
          strategy: "text-only",
          attempts: outcome.attempts,
          diagnostics: buildMatchDiagnostics(result, prepared, candidates),
        };
      }

      console.info("[match] text-only sem match confiável — fallback vision-legacy");
    } catch (err) {
      if (!isMatchTextOnlyFallbackVisionEnabled()) throw err;
      console.warn("[match] text-only falhou, fallback vision-legacy:", err);
    }
  }

  console.info("[match] strategy=vision-legacy (foto do post + JSON shortlist)");
  const visionInput = stripServerOnlyFields(prepared.input);
  const outcome = await runVisionWithFallback(
    operation,
    (provider) => provider.matchAndGenerate(visionInput),
    providerId
  );

  const visionMatchedId = outcome.result.matchedId;
  let result = finalizeMatchResult(outcome.result, prepared, candidates);

  if (
    !result.matchedId &&
    visionMatchedId &&
    isMatchTrustVisionOnRejectEnabled()
  ) {
    console.info(
      `[match] visão escolheu ${visionMatchedId} — validação só-JSON rejeitou; mantendo match visual`
    );
    result = {
      ...result,
      matchedId: visionMatchedId,
      matchMode: "catalog_json_vision",
      reasoning: result.reasoning
        ? `${result.reasoning}\n\n[Match visual] Referência confirmada pela foto do post (prioridade sobre fingerprint JSON).`
        : `[Match visual] Referência confirmada pela foto do post.`,
    };
  }

  const rejectReasons: string[] = [];
  if (fingerprint && result.matchedId) {
    const assessment = assessRankerCandidate(fingerprint, candidates, result.matchedId);
    if (assessment) rejectReasons.push(...assessment.rejectReasons);
  }

  return {
    result,
    prepared,
    providerUsed: outcome.providerUsed,
    modelUsed,
    strategy: "vision-legacy",
    attempts: outcome.attempts,
    diagnostics: buildMatchDiagnostics(result, prepared, candidates, rejectReasons),
  };
}

export function matchOperationHeaders(
  result: MatchOperationResult
): Record<string, string> {
  const headers: Record<string, string> = {
    "X-AI-Match-Strategy": result.strategy,
    "X-AI-Match-Mode": result.result.matchMode,
    "X-AI-Model-Used": result.modelUsed,
  };
  const shortlist = shortlistHeaderValue(result.prepared.shortlist);
  if (shortlist) headers["X-AI-Catalog-Shortlist"] = shortlist;
  return headers;
}
