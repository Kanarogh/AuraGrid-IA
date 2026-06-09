import type { AiProviderId } from "./types";

export type AiAttemptHeader = {
  provider: AiProviderId;
  error?: string;
  skipped?: string;
};

/** HTTP headers cannot contain CR/LF or other control characters. */
export function sanitizeForHttpHeader(value: string, maxLen = 2048): string {
  return value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, maxLen);
}

export function sanitizeAiAttemptsForHeader(
  attempts: AiAttemptHeader[]
): AiAttemptHeader[] {
  return attempts.map((a) => ({
    provider: a.provider,
    skipped: a.skipped,
    error: a.error ? sanitizeForHttpHeader(a.error, 240) : undefined,
  }));
}
