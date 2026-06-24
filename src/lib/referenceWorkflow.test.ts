import { describe, expect, it } from "vitest";
import { resolveUsesReferences } from "./referenceWorkflow";

describe("resolveUsesReferences", () => {
  it("defaults to true when no override", () => {
    expect(resolveUsesReferences(undefined, undefined)).toBe(true);
    expect(resolveUsesReferences(true, undefined)).toBe(true);
    expect(resolveUsesReferences(true, null)).toBe(true);
  });

  it("inherits client default false", () => {
    expect(resolveUsesReferences(false, null)).toBe(false);
    expect(resolveUsesReferences(false, undefined)).toBe(false);
  });

  it("period override wins", () => {
    expect(resolveUsesReferences(false, true)).toBe(true);
    expect(resolveUsesReferences(true, false)).toBe(false);
  });
});
