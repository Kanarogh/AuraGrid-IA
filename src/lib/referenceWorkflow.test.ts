import { describe, expect, it } from "vitest";
import type { CatalogItem } from "../types";
import {
  buildDisableReferencesConfirmMessage,
  countIndexedReferences,
  resolveUsesReferences,
} from "./referenceWorkflow";

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

describe("countIndexedReferences", () => {
  const refReady = {
    id: "1",
    isReference: true,
    enrichmentStatus: "ready",
    visualProfile: { label: "Look A" },
  } as CatalogItem;
  const refPending = {
    id: "2",
    isReference: true,
    enrichmentStatus: "pending",
  } as CatalogItem;
  const gridReady = {
    id: "3",
    isReference: false,
    enrichmentStatus: "ready",
    visualProfile: { label: "Grid" },
  } as CatalogItem;

  it("counts only indexed references", () => {
    expect(countIndexedReferences([refReady, refPending, gridReady])).toBe(1);
    expect(countIndexedReferences([])).toBe(0);
  });
});

describe("buildDisableReferencesConfirmMessage", () => {
  it("uses singular and plural forms", () => {
    expect(buildDisableReferencesConfirmMessage(1)).toContain("1 referência indexada");
    expect(buildDisableReferencesConfirmMessage(3)).toContain("3 referências indexadas");
    expect(buildDisableReferencesConfirmMessage(1)).toContain("não serão apagadas");
  });
});
