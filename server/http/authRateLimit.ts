import type { NextRequest } from "next/server";
import { checkRateLimit } from "./rateLimit";
import { getClientIp } from "./clientIp";
import { HttpError } from "./respond";

const AUTH_WINDOW_MS = 15 * 60_000;

export function assertAuthRateLimit(
  req: NextRequest,
  scope: "login" | "register" | "refresh",
  max: number
): void {
  const ip = getClientIp(req);
  const key = `auth-${scope}:${ip}`;
  const limit = checkRateLimit(key, max, AUTH_WINDOW_MS);
  if (!limit.ok) {
    throw new HttpError(
      429,
      `Muitas tentativas. Aguarde ${limit.retryAfterSec}s e tente novamente.`
    );
  }
}

export function authRateLimitHeaders(retryAfterSec: number): HeadersInit {
  return { "Retry-After": String(retryAfterSec) };
}
