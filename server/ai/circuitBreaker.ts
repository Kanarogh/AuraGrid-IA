import type { AiProviderId } from "./types.ts";

/**
 * Circuit breaker simples por provedor.
 *
 * Estados:
 * - closed: opera normalmente.
 * - cooldown: pula por COOLDOWN_MS após THRESHOLD falhas em WINDOW_MS.
 *
 * Cada sucesso reseta o contador. Não persiste — reinicia com o servidor.
 */

const THRESHOLD = 3;
const WINDOW_MS = 60_000;
const COOLDOWN_MS = 5 * 60_000;

type State = {
  failures: number[];
  cooldownUntil: number;
  lastError: string | null;
};

const state: Record<AiProviderId, State> = {
  gemini: { failures: [], cooldownUntil: 0, lastError: null },
  groq: { failures: [], cooldownUntil: 0, lastError: null },
  deepseek: { failures: [], cooldownUntil: 0, lastError: null },
  openrouter: { failures: [], cooldownUntil: 0, lastError: null },
};

export function isProviderInCooldown(provider: AiProviderId): boolean {
  return state[provider].cooldownUntil > Date.now();
}

export function recordSuccess(provider: AiProviderId): void {
  state[provider] = { failures: [], cooldownUntil: 0, lastError: null };
}

export function recordFailure(provider: AiProviderId, error: unknown): boolean {
  const now = Date.now();
  const s = state[provider];
  s.failures = s.failures.filter((ts) => now - ts < WINDOW_MS);
  s.failures.push(now);
  s.lastError = error instanceof Error ? error.message : String(error);

  if (s.failures.length >= THRESHOLD) {
    s.cooldownUntil = now + COOLDOWN_MS;
    s.failures = [];
    return true;
  }
  return false;
}

export function getCircuitBreakerSnapshot(): Record<
  AiProviderId,
  { inCooldown: boolean; cooldownUntil: number; lastError: string | null; failures: number }
> {
  const now = Date.now();
  return {
    gemini: snapshotFor("gemini", now),
    groq: snapshotFor("groq", now),
    deepseek: snapshotFor("deepseek", now),
    openrouter: snapshotFor("openrouter", now),
  };
}

function snapshotFor(provider: AiProviderId, now: number) {
  const s = state[provider];
  const inCooldown = s.cooldownUntil > now;
  return {
    inCooldown,
    cooldownUntil: inCooldown ? s.cooldownUntil : 0,
    lastError: s.lastError,
    failures: s.failures.filter((ts) => now - ts < WINDOW_MS).length,
  };
}
