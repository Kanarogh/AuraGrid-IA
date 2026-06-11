import type { CatalogVisualProfile } from "../types";

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

function asString(value: unknown, fallback = "—"): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export type CatalogProfileV2Stored = {
  version: 2;
  referenceLabel?: string;
  garment?: Record<string, unknown>;
  scene?: Record<string, unknown>;
};

export function isCatalogProfileV2(
  raw: Record<string, unknown> | undefined | null
): raw is CatalogProfileV2Stored {
  return !!raw && raw.version === 2 && typeof raw.garment === "object" && raw.garment !== null;
}

function pickAnchor(anchors: string[], pattern: RegExp): string {
  return anchors.find((a) => pattern.test(a)) ?? "";
}

function inferGarmentField(
  explicit: unknown,
  anchors: string[],
  pattern: RegExp
): string {
  const direct = asString(explicit, "");
  if (direct && direct !== "—") return direct;
  const fromAnchor = pickAnchor(anchors, pattern);
  return fromAnchor || "—";
}

function inferSceneSetting(
  setting: string,
  tags: string[]
): string {
  if (setting && setting !== "—" && setting !== "other") return setting;
  const hay = tags.join(" ");
  if (/grass|garden|palm|flower|outdoor/i.test(hay)) return "garden";
  if (/beach|sand|sea|ocean/i.test(hay)) return "beach";
  if (/street|urban|brick|sidewalk/i.test(hay)) return "street";
  if (/studio|white-bg/i.test(hay)) return "studio";
  return setting || "—";
}

/** Converte perfil v2 (armazenado no DB) para campos legíveis no modal. */
export function catalogProfileV2ToDisplay(
  raw: CatalogProfileV2Stored,
  label?: string
): CatalogVisualProfile {
  const g = raw.garment ?? {};
  const sc = raw.scene ?? {};
  const colors = asStringArray(g.colors);
  const anchors = asStringArray(g.anchors);
  const notList = asStringArray(g.not);
  const motif = asString(g.motif, "");
  const back = inferGarmentField(
    g.back,
    anchors,
    /back|costas|open-cross|halter-tie|low-open|criss-cross/i
  );
  const type = asString(g.type);
  const layout = asString(g.layout, "");
  const sceneTags = asStringArray(sc.tags);
  const setting = inferSceneSetting(asString(sc.setting, ""), sceneTags);
  const neckline = inferGarmentField(
    g.neck,
    anchors,
    /neck|decote|collar|halter|strapless|sweetheart|boat-neck/i
  );
  const sleeves = inferGarmentField(
    g.sleeve,
    anchors,
    /sleeve|manga|puff|cap-sleeve|sleeveless|off-shoulder/i
  );
  const lenPattern = /^(mini|midi|maxi|ankle|floor|knee)$|mini-dress|maxi-dress|midi-dress/i;
  const lenFromField = inferGarmentField(g.len, anchors, lenPattern);
  const dressLength =
    lenFromField !== "—"
      ? lenFromField
      : inferGarmentField(g.skirt, anchors, /tiered|pleated|ruffle|wrap-skirt|godet/i);
  const silhouette = inferGarmentField(
    g.sil,
    anchors,
    /a-line|fit-and-flare|empire|wrap|bodycon|silhouette|tiered/i
  );

  const visualParts = [
    type !== "—" ? type : "",
    colors.length ? colors.join(" / ") : "",
    motif && motif !== "—" ? motif : "",
    layout && layout !== "—" ? layout : "",
    back && back !== "—" ? `costas: ${back}` : "",
    g.len ? String(g.len) : "",
    setting && setting !== "—" ? `cenário: ${setting}` : "",
    sceneTags.length ? sceneTags.join(", ") : "",
  ].filter(Boolean);

  const fingerprint = [motif, back, asString(g.len, ""), layout]
    .filter((x) => x && x !== "—")
    .join(" · ");

  return {
    version: 1,
    referenceLabel: asString(raw.referenceLabel, label ?? "—"),
    garmentType: type,
    category: type,
    primaryColors: colors,
    secondaryColors: colors.slice(1),
    dominantColorFamily: colors[0] ?? "—",
    colorTemperature:
      g.temp === "warm" || g.temp === "cool" || g.temp === "neutral" ? g.temp : undefined,
    pattern: {
      type: layout !== "—" ? layout : motif !== "—" ? motif : "—",
      description: motif !== "—" ? motif : "—",
    },
    printScale: asString(g.scale, "") || undefined,
    neckline,
    sleeves,
    sleeveType: sleeves !== "—" ? sleeves : undefined,
    dressLength,
    lengthCategory: dressLength !== "—" ? dressLength : undefined,
    silhouette,
    fabricTexture: "—",
    embellishments: [],
    distinctiveDetails: anchors,
    matchKeywords: anchors,
    visualSummary: visualParts.length ? visualParts.join(" · ") : "Resumo visual não disponível.",
    distinguishingFingerprint: fingerprint || "—",
    matchAnchors: anchors.length ? anchors : undefined,
    notToConfuseWith: notList.length ? notList.join(", ") : undefined,
  };
}

export function catalogSceneFromProfile(
  raw: Record<string, unknown> | undefined | null
): { setting: string; tags: string[]; light?: string; mood?: string } | null {
  if (!isCatalogProfileV2(raw)) return null;
  const sc = raw.scene ?? {};
  const tags = asStringArray(sc.tags);
  return {
    setting: inferSceneSetting(asString(sc.setting, ""), tags),
    tags,
    light: asString(sc.light, "") || undefined,
    mood: asString(sc.mood, "") || undefined,
  };
}
