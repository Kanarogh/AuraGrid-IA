import type { AiProviderId } from "./types";

export type FallbackOutcome<T> = {
  result: T;
  providerUsed: AiProviderId;
  modelLabel?: string;
  attempts: Array<{ provider: AiProviderId; error?: string; skipped?: string }>;
};

export function stripAuraGridMeta<T extends Record<string, unknown>>(result: T): {
  profile: T;
  routedModel?: string;
} {
  return { profile: result };
}

export function buildVisionProviderChain(_active: AiProviderId): AiProviderId[] {
  return ["gemini"];
}

export function shouldTryNextProvider(_err: unknown): boolean {
  return false;
}
