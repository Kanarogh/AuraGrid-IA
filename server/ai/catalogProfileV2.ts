/** Schema v2 — JSON compacto: garment (match) + scene (legenda / contexto). */

export type CompactGarment = {
  type?: string;
  colors?: string[];
  temp?: string;
  motif?: string;
  layout?: string;
  scale?: string;
  back?: string;
  neck?: string;
  sleeve?: string;
  len?: string;
  skirt?: string;
  sil?: string;
  anchors?: string[];
  not?: string[];
};

export type CompactScene = {
  setting?: string;
  tags?: string[];
  light?: string;
  mood?: string;
};

export type CatalogProfileV2 = {
  version: 2;
  referenceLabel: string;
  garment: CompactGarment;
  scene: CompactScene;
};

/** Vista plana unificada para ranker (v1 legado ou v2). */
export type FlatGarmentView = {
  garmentType?: string;
  dominantColorFamily?: string;
  primaryColors?: string[];
  secondaryColors?: string[];
  colorTemperature?: string;
  patternMotif?: string;
  patternLayout?: string;
  patternType?: string;
  printScale?: string;
  backDetail?: string;
  neckline?: string;
  sleeves?: string;
  sleeveType?: string;
  dressLength?: string;
  lengthCategory?: string;
  silhouette?: string;
  skirtConstruction?: string;
  matchAnchors?: string[];
  notToConfuseWith?: string;
  matchKeywords?: string[];
  distinguishingFingerprint?: string;
  pattern?: { type?: string; description?: string };
  scene?: CompactScene;
};

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function toKebabToken(raw: string, maxLen = 48): string {
  const t = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLen);
  return t || "unknown";
}

export function asTokenArray(value: unknown, max = 8): string[] {
  if (!Array.isArray(value)) {
    if (typeof value === "string" && value.trim()) {
      return value
        .split(/[,;|]/)
        .map((s) => toKebabToken(s.trim()))
        .filter((s) => s !== "unknown")
        .slice(0, max);
    }
    return [];
  }
  return value
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((s) => (KEBAB.test(s.trim()) ? s.trim() : toKebabToken(s)))
    .filter((s) => s !== "unknown")
    .slice(0, max);
}

const SCENE_SETTINGS = new Set([
  "studio",
  "beach",
  "street",
  "garden",
  "indoor",
  "urban",
  "nature",
  "cafe",
  "home",
  "other",
]);

const LAYOUTS = new Set([
  "horizontal",
  "vertical",
  "radial",
  "placement",
  "all-over",
  "solid",
  "other",
]);

const LENGTHS = new Set(["mini", "knee", "midi", "maxi", "ankle", "floor", "other"]);

const LIGHTS = new Set(["natural", "golden-hour", "overcast", "studio-flash", "shade", "other"]);

export function buildEnrichCatalogPrompt(label: string, id: string): string {
  return `Fashion catalog analyst — Indian/boho women's wear. Reference: "${label || "unknown"}" (id: ${id || "n/a"}).

Output JSON v2 ONLY. Keywords in kebab-case (e.g. dusty-teal, geometric-medallion, open-cross-straps). NO sentences.

GARMENT (for strict SKU visual match — be DISCRIMINATIVE, focus on what is unique to THIS SKU):
- type: dress|top|set|saree|skirt|other
- colors: 1-2 specific shades (e.g. dusty-teal, off-white-cream — NOT generic "blue"/"white")
- temp: warm|cool|neutral
- motif: unique print id (tie-dye-horizontal, floral-ditsy, geometric-medallion, paisley-vertical, solid)
- layout: horizontal|vertical|radial|placement|all-over|solid|other
- scale: solid|micro|small|medium|large|all-over|other
- back: halter-tie|open-cross|low-open|full|unknown
- neck, sleeve, len (mini|knee|midi|maxi|...), skirt, sil
- anchors: 6-8 short kebab tokens VERIFIABLE in photo. MUST include:
    1. print motif token (e.g. medallion-symmetric, tie-dye-horizontal-band)
    2. back-detail token (open-cross-straps, halter-tie, full-closed)
    3. construction token (tiered-3-layers, ruffle-hem, pleated, godet)
    4. neckline token (v-neck-deep, square-neck, halter)
    5. trim/closure if visible (tassel-tie, button-front, side-zip, no-closure)
    6. fabric/texture token (lightweight-rayon, embroidered-cotton, crepe-flowy)
- not: 3-5 tokens — adjacent SKUs this is explicitly NOT (e.g. tie-dye-bands, floral-ditsy, mini-length)

SCENE (background/place — caption only, not for match):
- setting: studio|beach|street|garden|indoor|urban|nature|cafe|home|other
- tags: 2-5 tokens (white-bg, sand, palm-trees, brick-wall)
- light: natural|golden-hour|overcast|studio-flash|shade|other
- mood: optional 1-2 tokens (boho, minimal, editorial)

If plain white/neutral product photo: setting=studio, tags include white-bg.

CRITICAL:
- Every "anchors" token MUST be observable in the photo — do NOT guess.
- "not" tokens must be SHORT and SPECIFIC — they prevent confusion with sibling SKUs.
- When two SKUs share color family, motif + back + construction decide the match — describe them precisely.

JSON shape:
{
  "version": 2,
  "referenceLabel": "${label || "unknown"}",
  "garment": { "type", "colors", "temp", "motif", "layout", "scale", "back", "neck", "sleeve", "len", "skirt", "sil", "anchors", "not" },
  "scene": { "setting", "tags", "light", "mood" }
}`;
}

function pickAnchorToken(anchors: string[], pattern: RegExp): string | undefined {
  return anchors.find((a) => pattern.test(a));
}

/** Preenche neck/sleeve/len/sil a partir de anchors quando a IA omite campos explícitos. */
function backfillGarmentFromAnchors(g: CompactGarment): CompactGarment {
  const anchors = g.anchors ?? [];
  if (!anchors.length) return g;

  const lenFromAnchor = pickAnchorToken(
    anchors,
    /^(mini|midi|maxi|ankle|floor|knee|other)$|mini-dress|maxi-dress|midi-dress/i
  );

  return {
    ...g,
    neck:
      g.neck ??
      pickAnchorToken(anchors, /neck|decote|collar|halter|strapless|sweetheart|boat-neck/i),
    sleeve:
      g.sleeve ?? pickAnchorToken(anchors, /sleeve|manga|puff|cap-sleeve|sleeveless|off-shoulder/i),
    len: g.len ?? (lenFromAnchor ? normalizeLength(lenFromAnchor) : undefined),
    skirt:
      g.skirt ??
      pickAnchorToken(anchors, /tiered|pleated|ruffle|wrap-skirt|skirt|godet/i),
    sil:
      g.sil ??
      pickAnchorToken(anchors, /a-line|fit-and-flare|empire|wrap|bodycon|silhouette|tiered/i),
    back:
      g.back ??
      pickAnchorToken(anchors, /back|costas|open-cross|halter-tie|low-open|criss-cross/i),
  };
}

function normalizeGarmentBlock(g: Record<string, unknown>): CompactGarment {
  const base: CompactGarment = {
    type: g.type ? toKebabToken(String(g.type), 32) : undefined,
    colors: asTokenArray(g.colors ?? g.primaryColors, 3),
    temp: normalizeEnum(g.temp ?? g.colorTemperature, ["warm", "cool", "neutral"], "neutral"),
    motif: g.motif
      ? toKebabToken(String(g.motif), 56)
      : g.patternMotif
        ? toKebabToken(String(g.patternMotif), 56)
        : undefined,
    layout: normalizeLayout(g.layout ?? g.patternLayout),
    scale: g.scale ? toKebabToken(String(g.scale), 24) : undefined,
    back: g.back
      ? toKebabToken(String(g.back), 40)
      : g.backDetail
        ? toKebabToken(String(g.backDetail), 40)
        : undefined,
    neck: g.neck ? toKebabToken(String(g.neck), 32) : g.neckline ? toKebabToken(String(g.neckline), 32) : undefined,
    sleeve: g.sleeve
      ? toKebabToken(String(g.sleeve), 32)
      : g.sleeveType
        ? toKebabToken(String(g.sleeveType), 32)
        : g.sleeves
          ? toKebabToken(String(g.sleeves), 32)
          : undefined,
    len: normalizeLength(g.len ?? g.lengthCategory ?? g.dressLength),
    skirt: g.skirt ? toKebabToken(String(g.skirt), 32) : g.skirtConstruction ? toKebabToken(String(g.skirtConstruction), 32) : undefined,
    sil: g.sil ? toKebabToken(String(g.sil), 32) : g.silhouette ? toKebabToken(String(g.silhouette), 32) : undefined,
    anchors: asTokenArray(g.anchors ?? g.matchAnchors, 8),
    not: asTokenArray(g.not ?? g.notToConfuseWith, 6),
  };
  return backfillGarmentFromAnchors(base);
}

function normalizeSceneBlock(s: Record<string, unknown> | undefined): CompactScene {
  if (!s || typeof s !== "object") {
    return { setting: "studio", tags: ["white-bg"], light: "studio-flash" };
  }
  const setting = normalizeEnum(s.setting, Array.from(SCENE_SETTINGS), "other");
  const tags = asTokenArray(s.tags, 6);
  return {
    setting,
    tags: tags.length ? tags : setting === "studio" ? ["white-bg"] : tags,
    light: normalizeEnum(s.light, Array.from(LIGHTS), "natural"),
    mood: s.mood ? toKebabToken(String(s.mood), 24) : undefined,
  };
}

function normalizeEnum(value: unknown, allowed: string[], fallback: string): string {
  const t = typeof value === "string" ? toKebabToken(value, 32) : "";
  return allowed.includes(t) ? t : fallback;
}

function normalizeLayout(value: unknown): string | undefined {
  if (!value) return undefined;
  const t = toKebabToken(String(value), 24);
  return LAYOUTS.has(t) ? t : t || undefined;
}

function normalizeLength(value: unknown): string | undefined {
  if (!value) return undefined;
  const raw = String(value).toLowerCase();
  if (LENGTHS.has(raw)) return raw;
  const t = toKebabToken(raw, 16);
  if (LENGTHS.has(t)) return t;
  if (/mini|curto/i.test(raw)) return "mini";
  if (/midi/i.test(raw)) return "midi";
  if (/maxi|long|longo|floor|ankle/i.test(raw)) return "maxi";
  return "other";
}

/** Converte v1 legado → vista plana para ranker. */
export function flattenProfileForRanker(raw: Record<string, unknown> | undefined): FlatGarmentView {
  if (!raw || typeof raw !== "object") return {};

  if (raw.version === 2 && raw.garment && typeof raw.garment === "object") {
    const g = normalizeGarmentBlock(raw.garment as Record<string, unknown>);
    const scene = normalizeSceneBlock(
      raw.scene && typeof raw.scene === "object" ? (raw.scene as Record<string, unknown>) : undefined
    );
    const colors = g.colors ?? [];
    return {
      garmentType: g.type,
      dominantColorFamily: colors[0],
      primaryColors: colors,
      secondaryColors: colors.slice(1),
      colorTemperature: g.temp,
      patternMotif: g.motif,
      patternLayout: g.layout,
      printScale: g.scale,
      backDetail: g.back,
      neckline: g.neck,
      sleeves: g.sleeve,
      sleeveType: g.sleeve,
      dressLength: g.len,
      lengthCategory: g.len,
      silhouette: g.sil,
      skirtConstruction: g.skirt,
      matchAnchors: g.anchors,
      notToConfuseWith: (g.not ?? []).join(" "),
      matchKeywords: g.anchors,
      distinguishingFingerprint: [g.motif, g.back, g.len].filter(Boolean).join(" "),
      scene,
    };
  }

  const scene =
    raw.scene && typeof raw.scene === "object"
      ? normalizeSceneBlock(raw.scene as Record<string, unknown>)
      : inferLegacyScene(raw);

  return {
    garmentType: typeof raw.garmentType === "string" ? raw.garmentType : undefined,
    dominantColorFamily: typeof raw.dominantColorFamily === "string" ? raw.dominantColorFamily : undefined,
    primaryColors: asTokenArray(raw.primaryColors, 4),
    secondaryColors: asTokenArray(raw.secondaryColors, 3),
    colorTemperature: typeof raw.colorTemperature === "string" ? raw.colorTemperature : undefined,
    patternMotif: typeof raw.patternMotif === "string" ? raw.patternMotif : undefined,
    patternLayout: typeof raw.patternLayout === "string" ? raw.patternLayout : undefined,
    printScale: typeof raw.printScale === "string" ? raw.printScale : undefined,
    backDetail: typeof raw.backDetail === "string" ? raw.backDetail : undefined,
    neckline: typeof raw.neckline === "string" ? raw.neckline : undefined,
    sleeves: typeof raw.sleeves === "string" ? raw.sleeves : undefined,
    sleeveType: typeof raw.sleeveType === "string" ? raw.sleeveType : undefined,
    dressLength: typeof raw.dressLength === "string" ? raw.dressLength : undefined,
    lengthCategory: typeof raw.lengthCategory === "string" ? raw.lengthCategory : undefined,
    silhouette: typeof raw.silhouette === "string" ? raw.silhouette : undefined,
    skirtConstruction: typeof raw.skirtConstruction === "string" ? raw.skirtConstruction : undefined,
    matchAnchors: asTokenArray(raw.matchAnchors, 8),
    notToConfuseWith: typeof raw.notToConfuseWith === "string" ? raw.notToConfuseWith : undefined,
    matchKeywords: asTokenArray(raw.matchKeywords, 12),
    distinguishingFingerprint:
      typeof raw.distinguishingFingerprint === "string" ? raw.distinguishingFingerprint : undefined,
    pattern:
      typeof raw.pattern === "object" && raw.pattern && !Array.isArray(raw.pattern)
        ? (raw.pattern as { type?: string; description?: string })
        : undefined,
    scene,
  };
}

function inferLegacyScene(raw: Record<string, unknown>): CompactScene {
  const summary = String(raw.visualSummary ?? "").toLowerCase();
  if (/studio|white.?bg|fundo.?branco|produto/i.test(summary)) {
    return { setting: "studio", tags: ["white-bg"], light: "studio-flash" };
  }
  return { setting: "studio", tags: ["white-bg"], light: "studio-flash" };
}

export function coerceCatalogProfile(
  raw: Record<string, unknown>,
  label?: string
): CatalogProfileV2 {
  if (raw.version === 2 && raw.garment && typeof raw.garment === "object") {
    const garment = normalizeGarmentBlock(raw.garment as Record<string, unknown>);
    const scene = normalizeSceneBlock(
      raw.scene && typeof raw.scene === "object" ? (raw.scene as Record<string, unknown>) : undefined
    );
    return {
      version: 2,
      referenceLabel:
        typeof raw.referenceLabel === "string" && raw.referenceLabel.trim()
          ? raw.referenceLabel.trim()
          : label || "unknown",
      garment,
      scene,
    };
  }

  const flat = flattenProfileForRanker(raw);
  const garment = normalizeGarmentBlock({
    type: flat.garmentType,
    colors: flat.primaryColors,
    temp: flat.colorTemperature,
    motif: flat.patternMotif,
    layout: flat.patternLayout,
    scale: flat.printScale,
    back: flat.backDetail,
    neck: flat.neckline,
    sleeve: flat.sleeveType ?? flat.sleeves,
    len: flat.lengthCategory ?? flat.dressLength,
    skirt: flat.skirtConstruction,
    sil: flat.silhouette,
    anchors: flat.matchAnchors,
    not: flat.notToConfuseWith,
  });

  return {
    version: 2,
    referenceLabel: label || String(raw.referenceLabel ?? "unknown"),
    garment,
    scene: flat.scene ?? inferLegacyScene(raw),
  };
}

export class IncompleteCatalogProfileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IncompleteCatalogProfileError";
  }
}

export function assertCatalogProfileComplete(profile: CatalogProfileV2): void {
  const g = profile.garment;
  if (!g.type || g.type === "unknown") {
    throw new IncompleteCatalogProfileError("Perfil v2 incompleto: garment.type ausente.");
  }
  if (!g.colors?.length) {
    throw new IncompleteCatalogProfileError("Perfil v2 incompleto: garment.colors vazio.");
  }
  if (!g.motif || g.motif === "unknown") {
    throw new IncompleteCatalogProfileError("Perfil v2 incompleto: garment.motif ausente.");
  }
  if ((g.anchors?.length ?? 0) < 4) {
    throw new IncompleteCatalogProfileError("Perfil v2 incompleto: mínimo 4 garment.anchors.");
  }
  if (!profile.scene?.setting) {
    throw new IncompleteCatalogProfileError("Perfil v2 incompleto: scene.setting ausente.");
  }
}

export function finalizeCatalogProfile(
  raw: Record<string, unknown>,
  label?: string
): Record<string, unknown> {
  const profile = coerceCatalogProfile(raw, label);
  assertCatalogProfileComplete(profile);
  return profile as unknown as Record<string, unknown>;
}

/** Detalhes do perfil v2 usados no prompt de legenda para ancorar o gancho. */
export function extractMatchedGarmentDetails(
  profile: Record<string, unknown> | undefined
): {
  motif?: string;
  layout?: string;
  back?: string;
  neck?: string;
  sleeve?: string;
  len?: string;
  skirt?: string;
  silhouette?: string;
  colors?: string[];
  anchors?: string[];
} | undefined {
  if (!profile) return undefined;
  const p = coerceCatalogProfile(profile, "");
  const g = p.garment;
  const colors = g.colors?.filter(Boolean) ?? [];
  const anchors = g.anchors?.slice(0, 6).filter(Boolean) ?? [];

  const hasAnything =
    g.motif ||
    g.layout ||
    g.back ||
    g.neck ||
    g.sleeve ||
    g.len ||
    g.skirt ||
    g.sil ||
    colors.length ||
    anchors.length;

  if (!hasAnything) return undefined;

  return {
    motif: g.motif,
    layout: g.layout,
    back: g.back,
    neck: g.neck,
    sleeve: g.sleeve,
    len: g.len,
    skirt: g.skirt,
    silhouette: g.sil,
    colors: colors.length ? colors : undefined,
    anchors: anchors.length ? anchors : undefined,
  };
}

/** JSON mínimo enviado ao match (economia de tokens). */
export function compactProfileForMatchJson(
  id: string,
  label: string,
  profile: Record<string, unknown> | undefined
): Record<string, unknown> {
  const p = coerceCatalogProfile(profile ?? {}, label);
  const g = p.garment;
  return {
    id,
    label,
    g: {
      t: g.type,
      c: g.colors,
      m: g.motif,
      l: g.layout,
      b: g.back,
      n: g.neck,
      s: g.sleeve,
      len: g.len,
      a: g.anchors?.slice(0, 6),
      not: g.not?.slice(0, 4),
    },
    sc:
      p.scene.setting !== "studio"
        ? { st: p.scene.setting, tg: p.scene.tags?.slice(0, 4) }
        : undefined,
  };
}

export function buildSceneCaptionBlock(scene?: CompactScene | null): string {
  if (!scene?.setting) return "";
  const tags = scene.tags?.length ? scene.tags.join(", ") : "—";
  const mood = scene.mood ? `\n- mood: ${scene.mood}` : "";
  return `SCENE / AMBIENTE (weave naturally into the hook — atmosphere, light, place):
- setting: ${scene.setting}
- tags: ${tags}
- light: ${scene.light ?? "natural"}${mood}
Do not list tags mechanically; evoke the vibe in the brand voice.`;
}
