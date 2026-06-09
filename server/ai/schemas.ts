/** JSON Schema (OpenAPI-style) usado por Groq e referência para prompts */
export const CATALOG_PROFILE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    version: { type: "number", description: "Always 1" },
    referenceLabel: { type: "string" },
    garmentType: { type: "string" },
    category: { type: "string" },
    dominantColorFamily: { type: "string", description: "Specific dominant shade e.g. dusty teal" },
    colorTemperature: { type: "string", enum: ["warm", "cool", "neutral"] },
    primaryColors: { type: "array", items: { type: "string" } },
    secondaryColors: { type: "array", items: { type: "string" } },
    pattern: {
      type: "object",
      properties: {
        type: { type: "string" },
        description: { type: "string" },
      },
      required: ["type", "description"],
      additionalProperties: false,
    },
    printScale: {
      type: "string",
      description: "solid, micro, small, medium, large, all-over, other",
    },
    neckline: { type: "string" },
    sleeves: { type: "string" },
    sleeveType: { type: "string" },
    dressLength: { type: "string" },
    lengthCategory: {
      type: "string",
      description: "mini, knee, midi, maxi, ankle, floor, other",
    },
    silhouette: { type: "string" },
    fabricTexture: { type: "string" },
    embellishments: { type: "array", items: { type: "string" } },
    distinctiveDetails: { type: "array", items: { type: "string" } },
    matchAnchors: {
      type: "array",
      items: { type: "string" },
      description: "5-8 verifiable visual facts for matching",
    },
    notToConfuseWith: { type: "string" },
    matchKeywords: { type: "array", items: { type: "string" } },
    visualSummary: { type: "string" },
    distinguishingFingerprint: { type: "string" },
  },
  required: [
    "version",
    "referenceLabel",
    "garmentType",
    "category",
    "dominantColorFamily",
    "colorTemperature",
    "primaryColors",
    "secondaryColors",
    "pattern",
    "printScale",
    "neckline",
    "sleeves",
    "sleeveType",
    "dressLength",
    "lengthCategory",
    "silhouette",
    "fabricTexture",
    "embellishments",
    "distinctiveDetails",
    "matchAnchors",
    "notToConfuseWith",
    "matchKeywords",
    "visualSummary",
    "distinguishingFingerprint",
  ],
} as const;

export const MATCH_RESULT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    matchedId: {
      type: "string",
      description: "Exact catalog id, or empty string if no confident match",
    },
    reasoning: { type: "string" },
    caption: { type: "string" },
  },
  required: ["matchedId", "reasoning", "caption"],
} as const;

export const MATCH_REFERENCE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    matchedId: {
      type: "string",
      description: "Exact catalog id, or empty string if no confident match",
    },
    reasoning: { type: "string" },
  },
  required: ["matchedId", "reasoning"],
} as const;
