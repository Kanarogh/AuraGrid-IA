import { describe, expect, it } from "vitest";
import {
  extractReferenceTokens,
  findCatalogMatchesByHint,
  normalizeCatalogLabelToken,
  resolveKnownCatalogReference,
} from "./catalogLabelMatch";

const catalog = [
  { id: "cat_8060a", label: "8060 Pink" },
  { id: "cat_9146", label: "#00874 9146 Pink Front" },
  { id: "cat_8060b", label: "8060 Blue" },
];

describe("catalogLabelMatch", () => {
  it("normaliza tokens de label", () => {
    expect(normalizeCatalogLabelToken("#00874 9146")).toBe("008749146");
  });

  it("extrai tokens numéricos e ignora nomes genéricos", () => {
    expect(extractReferenceTokens("8060.jpg")).toContain("8060");
    expect(extractReferenceTokens("IMG_0001.jpg")).toEqual([]);
  });

  it("resolve match único por token no label", () => {
    const matches = findCatalogMatchesByHint(catalog, "8060");
    expect(matches.length).toBeGreaterThanOrEqual(2);
    expect(matches[0]?.score).toBeGreaterThan(0);
  });

  it("resolve referência explícita por id", () => {
    const result = resolveKnownCatalogReference(catalog, {
      matchedCatalogId: "cat_9146",
    });
    expect(result.status).toBe("known");
    if (result.status === "known") {
      expect(result.item.id).toBe("cat_9146");
      expect(result.source).toBe("explicit");
    }
  });

  it("marca ambíguo quando várias peças batem", () => {
    const result = resolveKnownCatalogReference(catalog, { label: "8060" });
    expect(result.status).toBe("ambiguous");
    if (result.status === "ambiguous") {
      expect(result.candidates.length).toBeGreaterThan(1);
    }
  });

  it("resolve label composto único", () => {
    const result = resolveKnownCatalogReference(catalog, {
      label: "#00874 9146 Pink Front",
    });
    expect(result.status).toBe("known");
    if (result.status === "known") {
      expect(result.item.id).toBe("cat_9146");
    }
  });

  it("retorna none sem pistas", () => {
    expect(resolveKnownCatalogReference(catalog, {}).status).toBe("none");
  });

  it("forceFullMatch ignora label", () => {
    expect(
      resolveKnownCatalogReference(catalog, {
        label: "8060",
        forceFullMatch: true,
      }).status
    ).toBe("none");
  });
});
