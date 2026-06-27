type RateLimitBucket = { count: number; resetAt: number };

const buckets = new Map<string, RateLimitBucket>();

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number };

/** Limite simples em memória (por instância) — suficiente para conter loops do cliente. */
export function checkRateLimit(
  key: string,
  max: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  if (bucket.count >= max) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  bucket.count += 1;
  return { ok: true };
}

/** Apenas para testes — não usar em produção. */
export function resetRateLimitsForTests() {
  buckets.clear();
}
