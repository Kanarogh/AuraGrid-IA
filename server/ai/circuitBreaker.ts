import type { AiProviderId } from "./types";

type Snapshot = {
  inCooldown: boolean;
  cooldownUntil: number;
  lastError: string | null;
  failures: number;
};

const snapshot: Record<AiProviderId, Snapshot> = {
  gemini: { inCooldown: false, cooldownUntil: 0, lastError: null, failures: 0 },
};

export function isProviderInCooldown(_provider: AiProviderId): boolean {
  return false;
}

export function recordSuccess(_provider: AiProviderId): void {}

export function recordFailure(_provider: AiProviderId, _error: unknown): boolean {
  return false;
}

export function getCircuitBreakerSnapshot(): Record<AiProviderId, Snapshot> {
  return snapshot;
}
