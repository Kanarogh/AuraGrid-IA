/** JSON Schema v2 — catálogo compacto (Groq / OpenRouter). */
export const CATALOG_PROFILE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    version: { type: "number", description: "Always 2" },
    referenceLabel: { type: "string" },
    garment: {
      type: "object",
      additionalProperties: false,
      properties: {
        type: { type: "string" },
        colors: { type: "array", items: { type: "string" } },
        temp: { type: "string", enum: ["warm", "cool", "neutral"] },
        motif: { type: "string" },
        layout: {
          type: "string",
          enum: ["horizontal", "vertical", "radial", "placement", "all-over", "solid", "other"],
        },
        scale: {
          type: "string",
          enum: ["solid", "micro", "small", "medium", "large", "all-over", "other"],
        },
        back: { type: "string" },
        neck: { type: "string" },
        sleeve: { type: "string" },
        len: {
          type: "string",
          enum: ["mini", "knee", "midi", "maxi", "ankle", "floor", "other"],
        },
        skirt: { type: "string" },
        sil: { type: "string" },
        anchors: { type: "array", items: { type: "string" } },
        not: { type: "array", items: { type: "string" } },
      },
      required: ["type", "colors", "motif", "anchors"],
    },
    scene: {
      type: "object",
      additionalProperties: false,
      properties: {
        setting: {
          type: "string",
          enum: ["studio", "beach", "street", "garden", "indoor", "urban", "nature", "cafe", "home", "other"],
        },
        tags: { type: "array", items: { type: "string" } },
        light: {
          type: "string",
          enum: ["natural", "golden-hour", "overcast", "studio-flash", "shade", "other"],
        },
        mood: { type: "string" },
      },
      required: ["setting", "tags", "light"],
    },
  },
  required: ["version", "referenceLabel", "garment", "scene"],
} as const;

export const MATCH_RESULT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    matchedId: { type: ["string", "null"] },
    reasoning: { type: "string" },
    caption: { type: "string" },
  },
  required: ["matchedId", "reasoning"],
} as const;

export const MATCH_REFERENCE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    matchedId: { type: ["string", "null"] },
    reasoning: { type: "string" },
  },
  required: ["matchedId", "reasoning"],
} as const;
