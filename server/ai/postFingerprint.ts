/** Análise leve da imagem do post — 1 foto, JSON pequeno, sem catálogo. */

export const POST_FINGERPRINT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    garmentType: { type: "string" },
    dominantColorFamily: { type: "string" },
    primaryColors: { type: "array", items: { type: "string" } },
    patternType: { type: "string" },
    printScale: { type: "string" },
    neckline: { type: "string" },
    sleeves: { type: "string" },
    dressLength: { type: "string" },
    silhouette: { type: "string" },
    visibleAnchors: {
      type: "array",
      items: { type: "string" },
      description: "3-8 verifiable visual facts seen in the image",
    },
  },
  required: ["garmentType", "dominantColorFamily", "primaryColors", "visibleAnchors"],
} as const;

export type PostVisualFingerprint = {
  garmentType?: string;
  dominantColorFamily?: string;
  primaryColors?: string[];
  patternType?: string;
  printScale?: string;
  neckline?: string;
  sleeves?: string;
  dressLength?: string;
  silhouette?: string;
  visibleAnchors?: string[];
};

export function buildPostFingerprintPrompt(): string {
  return `You are a fashion image analyst. Inspect the image and extract visual attributes for catalog matching.

Return JSON only with:
- garmentType, dominantColorFamily, primaryColors (specific shades)
- patternType, printScale, neckline, sleeves, dressLength, silhouette (use "unknown" if not visible)
- visibleAnchors: 3-8 short verifiable facts (e.g. "V-neckline", "floor-length", "large floral print")

Do NOT guess brand names or catalog labels. Be conservative.`;
}

export function normalizePostFingerprint(raw: Record<string, unknown>): PostVisualFingerprint {
  const primaryColors = Array.isArray(raw.primaryColors)
    ? raw.primaryColors.filter((c): c is string => typeof c === "string" && c.trim().length > 0)
    : [];
  const visibleAnchors = Array.isArray(raw.visibleAnchors)
    ? raw.visibleAnchors.filter((c): c is string => typeof c === "string" && c.trim().length > 0)
    : [];

  return {
    garmentType: typeof raw.garmentType === "string" ? raw.garmentType : undefined,
    dominantColorFamily:
      typeof raw.dominantColorFamily === "string" ? raw.dominantColorFamily : undefined,
    primaryColors,
    patternType: typeof raw.patternType === "string" ? raw.patternType : undefined,
    printScale: typeof raw.printScale === "string" ? raw.printScale : undefined,
    neckline: typeof raw.neckline === "string" ? raw.neckline : undefined,
    sleeves: typeof raw.sleeves === "string" ? raw.sleeves : undefined,
    dressLength: typeof raw.dressLength === "string" ? raw.dressLength : undefined,
    silhouette: typeof raw.silhouette === "string" ? raw.silhouette : undefined,
    visibleAnchors,
  };
}
