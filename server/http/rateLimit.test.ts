import { describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimitsForTests } from "./rateLimit";

describe("checkRateLimit", () => {
  it("permite até max chamadas na janela", () => {
    resetRateLimitsForTests();
    expect(checkRateLimit("k", 3, 60_000).ok).toBe(true);
    expect(checkRateLimit("k", 3, 60_000).ok).toBe(true);
    expect(checkRateLimit("k", 3, 60_000).ok).toBe(true);
    const blocked = checkRateLimit("k", 3, 60_000);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("isolates keys", () => {
    resetRateLimitsForTests();
    expect(checkRateLimit("a", 1, 60_000).ok).toBe(true);
    expect(checkRateLimit("b", 1, 60_000).ok).toBe(true);
    expect(checkRateLimit("a", 1, 60_000).ok).toBe(false);
  });
});
