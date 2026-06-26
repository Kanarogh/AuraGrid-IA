/** Schema v2 — JSON compacto: garment (match) + scene (legenda / contexto). */

export type FieldVisibility = "visible" | "not-visible";

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
  fabric?: string;
  construction?: string;
  trim?: string;
  anchors?: string[];
  not?: string[];
  fieldVisibility?: Partial<Record<string, FieldVisibility>>;
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
  fabric?: string;
  construction?: string;
  trim?: string;
  fieldVisibility?: Partial<Record<string, FieldVisibility>>;
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

export type CatalogEnrichmentStatus = "ready" | "ready_limited";

export type CatalogSelfCritique = {
  removeAnchors?: string[];
  addAnchors?: string[];
  patches?: {
    motif?: string;
    back?: string;
    neck?: string;
    sleeve?: string;
    len?: string;
    skirt?: string;
    sil?: string;
    fabric?: string;
    construction?: string;
    trim?: string;
    not?: string[];
  };
  fieldVisibility?: Partial<Record<string, FieldVisibility>>;
};

export function buildEnrichCatalogPrompt(label: string, id: string): string {
  return `Fashion catalog analyst — Indian/boho women's wear. Reference: "${label || "unknown"}" (id: ${id || "n/a"}).

Output JSON v2 ONLY. Keywords in kebab-case (e.g. dusty-teal, geometric-medallion, open-cross-straps). NO sentences.
STRICT SIZE: each string max 48 chars; max 8 anchors, 5 not tokens, 5 scene tags; total JSON under 2 KB. NEVER paste image/base64 data.

GARMENT (for strict SKU visual match — be DISCRIMINATIVE, focus on what is unique to THIS SKU):
- type: dress|top|set|saree|skirt|other
- colors: 1-2 specific shades (e.g. dusty-teal, off-white-cream — NOT generic "blue"/"white")
- temp: warm|cool|neutral
- motif: unique print id (tie-dye-horizontal, floral-ditsy, geometric-medallion, paisley-vertical, solid)
- layout: horizontal|vertical|radial|placement|all-over|solid|other
- scale: solid|micro|small|medium|large|all-over|other
- back: halter-tie|open-cross|low-open|full|back-not-visible|unknown
- neck, sleeve, len (mini|knee|midi|maxi|...), skirt, sil
- fabric: 1 texture token (cotton-voile, crepe-flowy, embroidered-cotton, rayon-lightweight)
- construction: 1 construction token (tiered-3-layers, wrap-front, godet-panels, smocked-bodice)
- trim: 0-1 closure/trim token if visible (tassel-tie, cord-belt, button-front, side-zip, no-closure)
- anchors: 6-8 short kebab tokens VERIFIABLE in photo. MUST include when visible:
    1. print motif token
    2. back-detail token OR "back-not-visible" if rear not shown
    3. construction token (tiered-3-layers, ruffle-hem, pleated)
    4. neckline token
    5. trim/closure if visible
    6. fabric/texture token
- not: 3-5 tokens — adjacent SKUs this is explicitly NOT

HONESTY (critical):
- If back/skirt/neck not visible in photo → use "back-not-visible", "skirt-not-visible", etc. in anchors OR omit that field.
- Do NOT invent details you cannot see — a honest sparse profile beats a guessed rich one.

SCENE (background/place — caption only, not for match):
- setting: studio|beach|street|garden|indoor|urban|nature|cafe|home|other
- tags: 2-5 tokens (white-bg, sand, palm-trees, brick-wall)
- light: natural|golden-hour|overcast|studio-flash|shade|other
- mood: optional 1-2 tokens (boho, minimal, editorial)

If plain white/neutral product photo: setting=studio, tags include white-bg.

JSON shape:
{
  "version": 2,
  "referenceLabel": "${label || "unknown"}",
  "garment": { "type", "colors", "temp", "motif", "layout", "scale", "back", "neck", "sleeve", "len", "skirt", "sil", "fabric", "construction", "trim", "anchors", "not" },
  "scene": { "setting", "tags", "light", "mood" }
}`;
}

export function buildCatalogSelfCritiquePrompt(
  label: string,
  id: string,
  draftProfile: CatalogProfileV2,
  siblingLabels: string[] = []
): string {
  const draftJson = JSON.stringify(draftProfile);
  const siblingBlock =
    siblingLabels.length > 0
      ? `
SIBLING SKUs ALREADY IN CATALOG (refine "not" to distinguish THIS piece from these — labels only):
${siblingLabels.map((l, i) => `${i + 1}. "${l}"`).join("\n")}
- Add/refine "not" tokens that separate this SKU from siblings without inventing.`
      : "";

  return `Fashion catalog quality reviewer — critique and refine the draft profile for "${label}" (id: ${id}).

You see the SAME photo + the draft JSON from phase A. Output critique patches ONLY.

TASKS:
1. REMOVE anchors from removeAnchors that are NOT verifiable in the photo (hallucinated).
2. ADD missing anchors to addAnchors only if clearly visible (max 3 new).
3. patches: fix garment fields that were guessed wrong; refine "not" array (3-5 tokens).
4. fieldVisibility: mark each key field as "visible" or "not-visible" (back, skirt, neck, motif, sleeve).
   - If back not shown → fieldVisibility.back = "not-visible" and patches.back = "back-not-visible".

RULES:
- Do NOT add anchors you cannot verify.
- Prefer honest "not-visible" over invented detail.
- Keep kebab-case tokens.${siblingBlock}

DRAFT PROFILE JSON (compact summary — do not expand):
${draftJson.length > 6000 ? `${draftJson.slice(0, 6000)}…` : draftJson}`;
}

function normalizeFieldVisibility(
  raw: unknown
): Partial<Record<string, FieldVisibility>> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Partial<Record<string, FieldVisibility>> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const v = String(value).toLowerCase();
    if (v === "visible" || v === "not-visible") {
      out[key] = v;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

function isNotVisibleToken(value: string | undefined): boolean {
  if (!value) return false;
  return /not-visible|unknown/i.test(value);
}

function countObservableAnchors(g: CompactGarment): number {
  const skip = new Set(["back-not-visible", "skirt-not-visible", "neck-not-visible"]);
  return (g.anchors ?? []).filter((a) => {
    const t = a.toLowerCase();
    if (skip.has(t)) return false;
    if (t.endsWith("-not-visible")) return false;
    return t.length > 2;
  }).length;
}

/** Mescla autocrítica da Fase B no perfil da Fase A. */
export function mergeCatalogSelfCritique(
  draft: CatalogProfileV2,
  critique: CatalogSelfCritique
): CatalogProfileV2 {
  const g = { ...draft.garment };
  const remove = new Set(
    (critique.removeAnchors ?? []).map((a) => a.toLowerCase().trim()).filter(Boolean)
  );
  let anchors = (g.anchors ?? []).filter((a) => !remove.has(a.toLowerCase()));
  const add = (critique.addAnchors ?? [])
    .map((a) => toKebabToken(a, 48))
    .filter((a) => a !== "unknown" && !anchors.some((x) => x.toLowerCase() === a));
  anchors = [...anchors, ...add].slice(0, 8);

  const patches = critique.patches ?? {};
  if (patches.motif) g.motif = toKebabToken(patches.motif, 56);
  if (patches.back) g.back = toKebabToken(patches.back, 40);
  if (patches.neck) g.neck = toKebabToken(patches.neck, 32);
  if (patches.sleeve) g.sleeve = toKebabToken(patches.sleeve, 32);
  if (patches.len) g.len = normalizeLength(patches.len);
  if (patches.skirt) g.skirt = toKebabToken(patches.skirt, 32);
  if (patches.sil) g.sil = toKebabToken(patches.sil, 32);
  if (patches.fabric) g.fabric = toKebabToken(patches.fabric, 40);
  if (patches.construction) g.construction = toKebabToken(patches.construction, 40);
  if (patches.trim) g.trim = toKebabToken(patches.trim, 32);
  if (patches.not?.length) g.not = asTokenArray(patches.not, 6);

  g.anchors = anchors;
  g.fieldVisibility = {
    ...(g.fieldVisibility ?? {}),
    ...(critique.fieldVisibility ?? {}),
  };

  return {
    ...draft,
    garment: backfillGarmentFromAnchors(g),
  };
}

const PRINT_ANCHOR_RE =
  /floral|geometric|tie-dye|paisley|medallion|ditsy|print|pattern|stripe|polka/i;
const LENGTH_CONFLICT: Record<string, RegExp> = {
  mini: /maxi|floor-length|ankle-length/i,
  maxi: /mini-dress|mini-length|^mini$/i,
  midi: /floor-length/i,
};

/** Validação leve pós-IA — remove conflitos óbvios. */
export function validateProfileCoherence(profile: CatalogProfileV2): {
  profile: CatalogProfileV2;
  limited: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  const g = { ...profile.garment };
  let limited = false;

  if (!g.colors?.length) {
    warnings.push("colors vazio");
    limited = true;
  }

  let anchors = [...(g.anchors ?? [])];
  const motif = (g.motif ?? "").toLowerCase();

  if (motif === "solid" || motif.includes("solid")) {
    const before = anchors.length;
    anchors = anchors.filter((a) => !PRINT_ANCHOR_RE.test(a));
    if (anchors.length < before) warnings.push("anchors conflitam com motif solid");
  }

  if (g.len && LENGTH_CONFLICT[g.len]) {
    const re = LENGTH_CONFLICT[g.len]!;
    const before = anchors.length;
    anchors = anchors.filter((a) => !re.test(a));
    if (anchors.length < before) warnings.push(`anchors conflitam com len=${g.len}`);
  }

  g.anchors = anchors;

  const observable = countObservableAnchors(g);
  if (observable < 3) {
    warnings.push(`apenas ${observable} anchors observáveis`);
    limited = true;
  }

  return {
    profile: { ...profile, garment: backfillGarmentFromAnchors(g) },
    limited,
    warnings,
  };
}

export function assessProfileReadiness(profile: CatalogProfileV2): CatalogEnrichmentStatus {
  const g = profile.garment;
  if (!g.type || g.type === "unknown") return "ready_limited";
  if (!g.colors?.length) return "ready_limited";
  if (!g.motif || g.motif === "unknown") return "ready_limited";
  if (countObservableAnchors(g) < 3) return "ready_limited";
  return "ready";
}

/** Labels de SKUs irmãs já indexadas (mesmo tipo + cor próxima). */
export function findSiblingCatalogLabels(
  indexed: Array<{ id: string; label: string; profile: CatalogProfileV2 }>,
  draft: CatalogProfileV2,
  excludeId: string,
  max = 3
): string[] {
  const type = draft.garment.type;
  const color = draft.garment.colors?.[0]?.toLowerCase();
  if (!type) return [];

  return indexed
    .filter((item) => item.id !== excludeId)
    .map((item) => {
      const g = item.profile.garment;
      let score = 0;
      if (g.type === type) score += 2;
      const ic = g.colors?.[0]?.toLowerCase();
      if (color && ic) {
        if (ic === color) score += 2;
        else if (ic.includes(color) || color.includes(ic)) score += 1;
      }
      return { label: item.label, score };
    })
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, max)
    .map((x) => x.label);
}

/** Texto derivado do perfil para embedding híbrido. */
export function buildCatalogEmbeddingText(profile: CatalogProfileV2): string {
  const g = profile.garment;
  const parts = [
    g.type,
    ...(g.colors ?? []),
    g.temp,
    g.motif,
    g.layout,
    g.back,
    g.neck,
    g.sleeve,
    g.len,
    g.skirt,
    g.sil,
    g.fabric,
    g.construction,
    g.trim,
    ...(g.anchors ?? []).slice(0, 6),
  ].filter(Boolean);
  return parts.join(" ");
}

export function finalizeDeepCatalogProfile(
  phaseA: Record<string, unknown>,
  critique: CatalogSelfCritique | null | undefined,
  label?: string
): { profile: Record<string, unknown>; status: CatalogEnrichmentStatus } {
  let profile = coerceCatalogProfile(phaseA, label);
  if (critique) {
    profile = mergeCatalogSelfCritique(profile, critique);
  }
  const validated = validateProfileCoherence(profile);
  profile = validated.profile;
  const status = assessProfileReadiness(profile);
  const finalStatus: CatalogEnrichmentStatus =
    validated.limited && status === "ready" ? "ready_limited" : status;
  return { profile: profile as unknown as Record<string, unknown>, status: finalStatus };
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
      (() => {
        const token = pickAnchorToken(
          anchors,
          /back|costas|open-cross|halter-tie|low-open|criss-cross/i
        );
        return token && !isNotVisibleToken(token) ? token : undefined;
      })(),
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
    fabric: g.fabric ? toKebabToken(String(g.fabric), 40) : undefined,
    construction: g.construction ? toKebabToken(String(g.construction), 40) : undefined,
    trim: g.trim ? toKebabToken(String(g.trim), 32) : undefined,
    anchors: asTokenArray(g.anchors ?? g.matchAnchors, 8),
    not: asTokenArray(g.not ?? g.notToConfuseWith, 6),
    fieldVisibility: normalizeFieldVisibility(g.fieldVisibility),
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
      distinguishingFingerprint: [g.motif, g.back, g.len, g.fabric, g.construction]
        .filter(Boolean)
        .join(" "),
      fabric: g.fabric,
      construction: g.construction,
      trim: g.trim,
      fieldVisibility: g.fieldVisibility,
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
  if (!profile.scene?.setting) {
    throw new IncompleteCatalogProfileError("Perfil v2 incompleto: scene.setting ausente.");
  }
}

export function isCatalogProfileUsableForMatch(profile: CatalogProfileV2): boolean {
  const status = assessProfileReadiness(profile);
  return status === "ready" || status === "ready_limited";
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
      tmp: g.temp,
      m: g.motif,
      l: g.layout,
      sc: g.scale,
      b: g.back,
      n: g.neck,
      s: g.sleeve,
      len: g.len,
      sk: g.skirt,
      sil: g.sil,
      fab: g.fabric,
      con: g.construction,
      tr: g.trim,
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
