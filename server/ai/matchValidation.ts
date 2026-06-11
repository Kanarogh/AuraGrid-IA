import type { CatalogProfilePayload } from "./operations";
import type { PostVisualFingerprint } from "./postFingerprint";
import { assessRankerCandidate } from "./matchRankerDecision";
import type { MatchGenerateResult } from "./types";

/** Rejeita matches da IA quando o ranker visual não confirma com confiança. */
export function validateMatchDecision(
  result: MatchGenerateResult,
  fingerprint: PostVisualFingerprint | null | undefined,
  candidates: CatalogProfilePayload[]
): MatchGenerateResult {
  if (!result.matchedId || !fingerprint || candidates.length === 0) {
    return result;
  }

  const assessment = assessRankerCandidate(fingerprint, candidates, result.matchedId);
  if (!assessment || assessment.rejectReasons.length === 0) return result;

  console.info(
    `[match-validation] matchedId rejeitado → ${result.matchedId} (${assessment.rejectReasons.join("; ")})`
  );

  return {
    ...result,
    matchedId: null,
    reasoning: result.reasoning
      ? `${result.reasoning}\n\n[Validação visual] Match rejeitado — ${assessment.rejectReasons.join("; ")}. Referência omitida por segurança.`
      : `[Validação visual] Match rejeitado — ${assessment.rejectReasons.join("; ")}.`,
  };
}
