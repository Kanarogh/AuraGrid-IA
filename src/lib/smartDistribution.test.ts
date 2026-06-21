import { describe, expect, it } from "vitest";
import {
  buildDistributionPreview,
  computePostsPerDay,
  DEFAULT_DISTRIBUTION_PREFS,
  resolveDistributionOptions,
  suggestDenseDaysCount,
} from "./smartDistribution";

describe("smartDistribution", () => {
  it("sequencial com 12 looks preenche dias 1-12", () => {
    const postsPerDay = computePostsPerDay(12, {
      maxPostsPerDay: 3,
      denseDaysCount: 3,
      sparseStrategy: "sequential",
    });
    expect(postsPerDay.slice(0, 12).every((c) => c === 1)).toBe(true);
    expect(postsPerDay.slice(12).every((c) => c === 0)).toBe(true);
    expect(postsPerDay.reduce((a, b) => a + b, 0)).toBe(12);
  });

  it("spread com 12 looks distribui nos 30 dias", () => {
    const postsPerDay = computePostsPerDay(12, {
      maxPostsPerDay: 3,
      denseDaysCount: 3,
      sparseStrategy: "spread",
    });
    expect(postsPerDay.reduce((a, b) => a + b, 0)).toBe(12);
    expect(postsPerDay.filter((c) => c > 0).length).toBeGreaterThan(8);
  });

  it("30 looks = 1 por dia", () => {
    const postsPerDay = computePostsPerDay(30, {
      maxPostsPerDay: 3,
      denseDaysCount: 3,
      sparseStrategy: "sequential",
    });
    expect(postsPerDay.every((c) => c === 1)).toBe(true);
  });

  it("36 looks com max 3 e 3 dias densos", () => {
    const prefs = { ...DEFAULT_DISTRIBUTION_PREFS, useAutoDenseDays: false, denseDaysCount: 3 };
    const options = resolveDistributionOptions(36, prefs);
    const postsPerDay = computePostsPerDay(36, options);
    expect(postsPerDay.reduce((a, b) => a + b, 0)).toBe(36);
    expect(postsPerDay[0]).toBe(3);
    expect(postsPerDay[1]).toBe(3);
    expect(postsPerDay[2]).toBe(3);
    expect(postsPerDay[3]).toBe(1);
  });

  it("sugere dias densos para excedente", () => {
    expect(suggestDenseDaysCount(36, 3)).toBe(3);
    expect(suggestDenseDaysCount(34, 2)).toBe(4);
  });

  it("preview inclui resumo legível", () => {
    const preview = buildDistributionPreview(36, DEFAULT_DISTRIBUTION_PREFS);
    expect(preview.summaryLines.length).toBeGreaterThan(0);
    expect(preview.totalSlots).toBe(36);
    expect(preview.overflowCount).toBe(0);
  });

  it("45 looks distribui todo excedente", () => {
    const postsPerDay = computePostsPerDay(45, {
      maxPostsPerDay: 3,
      denseDaysCount: 8,
      sparseStrategy: "sequential",
    });
    expect(postsPerDay.reduce((a, b) => a + b, 0)).toBe(45);
  });
});
