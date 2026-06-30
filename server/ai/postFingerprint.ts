/** Fingerprint v2 — garment (match) + scene (legenda), tokens compactos. */

import type { CompactGarment, CompactScene } from "./catalogProfileV2";
import { asTokenArray, toKebabToken } from "./catalogProfileV2";

export const POST_FINGERPRINT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    garment: {
      type: "object",
      additionalProperties: false,
      properties: {
        type: { type: "string" },
        colors: { type: "array", items: { type: "string" } },
        motif: { type: "string" },
        layout: { type: "string" },
        scale: { type: "string" },
        back: { type: "string" },
        neck: { type: "string" },
        sleeve: { type: "string" },
        len: { type: "string" },
        skirt: { type: "string" },
        sil: { type: "string" },
        anchors: { type: "array", items: { type: "string" } },
      },
      required: ["type", "colors", "motif", "anchors"],
    },
    scene: {
      type: "object",
      additionalProperties: false,
      properties: {
        setting: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        light: { type: "string" },
        mood: { type: "string" },
      },
      required: ["setting", "tags"],
    },
  },
  required: ["garment", "scene"],
} as const;

export type PostVisualFingerprint = {
  garment?: CompactGarment;
  scene?: CompactScene;
  /** Vista plana legada — preenchida por normalizePostFingerprint para o ranker. */
  garmentType?: string;
  dominantColorFamily?: string;
  primaryColors?: string[];
  patternType?: string;
  patternMotif?: string;
  patternLayout?: string;
  printScale?: string;
  neckline?: string;
  backDetail?: string;
  sleeves?: string;
  dressLength?: string;
  silhouette?: string;
  skirtConstruction?: string;
  visibleAnchors?: string[];
};

export function buildPostFingerprintPrompt(): string {
  return `Visual content analyst — extract COMPACT JSON v2 for catalog matching + caption context.

KEYWORDS ONLY — kebab-case tokens, NO sentences.

GARMENT (match — discriminative):
- type, colors (1-2 specific shades), motif (tie-dye-horizontal, geometric-medallion, floral-ditsy, solid)
- layout: horizontal|vertical|radial|placement|all-over|solid
- scale, back (halter-tie, open-cross, low-open), neck, sleeve, len, skirt, sil
- anchors: 4-6 verifiable tokens — MUST include print motif + back if visible

SCENE (caption — background/place):
- setting: beach|street|studio|garden|urban|indoor|nature|cafe|home|other
- tags: 3-6 tokens (sand, ocean, palm-trees, brick-wall, golden-sky)
- light: natural|golden-hour|overcast|studio-flash|shade
- mood: optional 1-2 tokens (boho, editorial)

When siblings share color family, motif + back decide the match — describe precisely.
Do NOT guess catalog codes.`;
}

function normalizeGarmentFromRaw(g: Record<string, unknown>): CompactGarment {
  return {
    type: g.type ? toKebabToken(String(g.type), 32) : undefined,
    colors: asTokenArray(g.colors ?? g.primaryColors, 3),
    motif: g.motif
      ? toKebabToken(String(g.motif), 56)
      : g.patternMotif
        ? toKebabToken(String(g.patternMotif), 56)
        : undefined,
    layout: g.layout
      ? toKebabToken(String(g.layout), 24)
      : g.patternLayout
        ? toKebabToken(String(g.patternLayout), 24)
        : undefined,
    scale: g.scale ? toKebabToken(String(g.scale), 24) : g.printScale ? toKebabToken(String(g.printScale), 24) : undefined,
    back: g.back ? toKebabToken(String(g.back), 40) : g.backDetail ? toKebabToken(String(g.backDetail), 40) : undefined,
    neck: g.neck ? toKebabToken(String(g.neck), 32) : g.neckline ? toKebabToken(String(g.neckline), 32) : undefined,
    sleeve: g.sleeve
      ? toKebabToken(String(g.sleeve), 32)
      : g.sleeves
        ? toKebabToken(String(g.sleeves), 32)
        : undefined,
    len: g.len
      ? toKebabToken(String(g.len), 16)
      : g.dressLength
        ? toKebabToken(String(g.dressLength), 16)
        : undefined,
    skirt: g.skirt
      ? toKebabToken(String(g.skirt), 32)
      : g.skirtConstruction
        ? toKebabToken(String(g.skirtConstruction), 32)
        : undefined,
    sil: g.sil ? toKebabToken(String(g.sil), 32) : g.silhouette ? toKebabToken(String(g.silhouette), 32) : undefined,
    anchors: asTokenArray(g.anchors ?? g.visibleAnchors, 8),
  };
}

function normalizeSceneFromRaw(s: Record<string, unknown> | undefined): CompactScene {
  if (!s || typeof s !== "object") {
    return { setting: "other", tags: [], light: "natural" };
  }
  return {
    setting: s.setting ? toKebabToken(String(s.setting), 24) : "other",
    tags: asTokenArray(s.tags, 6),
    light: s.light ? toKebabToken(String(s.light), 24) : "natural",
    mood: s.mood ? toKebabToken(String(s.mood), 24) : undefined,
  };
}

/** Expõe vista plana + blocos v2 para ranker e legenda. */
export function normalizePostFingerprint(raw: Record<string, unknown>): PostVisualFingerprint {
  let garment: CompactGarment;
  let scene: CompactScene;

  if (raw.garment && typeof raw.garment === "object") {
    garment = normalizeGarmentFromRaw(raw.garment as Record<string, unknown>);
    scene = normalizeSceneFromRaw(
      raw.scene && typeof raw.scene === "object" ? (raw.scene as Record<string, unknown>) : undefined
    );
  } else {
    garment = normalizeGarmentFromRaw(raw);
    scene = normalizeSceneFromRaw(
      raw.scene && typeof raw.scene === "object" ? (raw.scene as Record<string, unknown>) : undefined
    );
  }

  const colors = garment.colors ?? [];
  const anchors = garment.anchors ?? [];

  return {
    garment,
    scene,
    garmentType: garment.type,
    dominantColorFamily: colors[0],
    primaryColors: colors,
    patternType: garment.motif,
    patternMotif: garment.motif,
    patternLayout: garment.layout,
    printScale: garment.scale,
    neckline: garment.neck,
    backDetail: garment.back,
    sleeves: garment.sleeve,
    dressLength: garment.len,
    silhouette: garment.sil,
    skirtConstruction: garment.skirt,
    visibleAnchors: anchors,
  };
}
