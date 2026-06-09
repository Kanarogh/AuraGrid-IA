/** Prompt e normalização compartilhados para indexação do catálogo (visão). */

export function buildEnrichCatalogPrompt(label: string, id: string): string {
  return `You are a senior fashion catalog analyst specializing in Indian/boho women's wear (dresses, sets, sarees).
Analyze this garment reference photo EXHAUSTIVELY. Wholesale reference code: "${label || "unknown"}" (catalog id: ${id || "n/a"}).

This JSON will be used WITHOUT this photo later — another AI must match social media post images ONLY from your JSON.
Your goal: make each profile UNIQUE and DISCRIMINATING so similar dresses in the same catalog are NOT confused.

CRITICAL RULES:
- Use SPECIFIC color names with shade (e.g. "dusty teal", "coral pink", "mustard yellow") — never only "green" or "blue".
- Describe print SCALE: micro floral, small ditsy floral, medium botanical, large floral, geometric, solid, paisley, etc.
- Neckline: be precise (deep V, modest V, round, square, halter, off-shoulder, sweetheart, boat, etc.).
- Sleeves: precise length and style (sleeveless, cap, short puff, 3/4 bell, long fitted, etc.).
- Length: mini / knee / midi / maxi / ankle / floor — state where hem falls on body.
- matchAnchors: 5–8 SHORT factual statements another model can verify in a post photo (e.g. "micro pink floral on navy base", "deep V neckline", "three-quarter bell sleeves", "maxi length to ankle").
- notToConfuseWith: 1–2 sentences on what SIMILAR catalog items look like and how THIS piece differs (color shade, print size, neckline, etc.).
- distinguishingFingerprint: ONE sentence with the 3 most unique visual identifiers combined.
- matchKeywords: 10–18 lowercase tokens including color shade, print type, neckline, sleeve, length.

Use ONLY values you can see — do not invent.

Required JSON shape:
{
  "version": 1,
  "referenceLabel": string,
  "garmentType": string,
  "category": string,
  "dominantColorFamily": string,
  "colorTemperature": "warm" | "cool" | "neutral",
  "primaryColors": [string, ...],
  "secondaryColors": [string, ...],
  "pattern": { "type": string, "description": string },
  "printScale": "solid" | "micro" | "small" | "medium" | "large" | "all-over" | "other",
  "neckline": string,
  "sleeves": string,
  "sleeveType": string,
  "dressLength": string,
  "lengthCategory": "mini" | "knee" | "midi" | "maxi" | "ankle" | "floor" | "other",
  "silhouette": string,
  "fabricTexture": string,
  "embellishments": [string, ...],
  "distinctiveDetails": [string, ...],
  "matchAnchors": [string, ...],
  "notToConfuseWith": string,
  "matchKeywords": [string, ...],
  "visualSummary": string,
  "distinguishingFingerprint": string
}

Set referenceLabel to "${label || "unknown"}". Set version to 1.`;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

/** Converte respostas “soltas” (OpenRouter free, modelos fracos) para o schema oficial. */
export function coerceCatalogProfile(
  raw: Record<string, unknown>,
  label?: string
): Record<string, unknown> {
  const p = { ...raw };

  if (!p.primaryColors) {
    if (p.primaryColor) p.primaryColors = asStringArray(p.primaryColor);
    else if (p.color) p.primaryColors = asStringArray(p.color);
  }
  if (!p.secondaryColors) p.secondaryColors = asStringArray(p.secondaryColors);

  if (typeof p.pattern === "string") {
    p.pattern = { type: "other", description: p.pattern };
  }
  if (!p.pattern || typeof p.pattern !== "object" || Array.isArray(p.pattern)) {
    p.pattern = { type: "other", description: "—" };
  } else {
    const pat = p.pattern as Record<string, unknown>;
    p.pattern = {
      type: typeof pat.type === "string" && pat.type.trim() ? pat.type : "other",
      description:
        typeof pat.description === "string" && pat.description.trim()
          ? pat.description
          : "—",
    };
  }

  p.dressLength =
    (typeof p.dressLength === "string" && p.dressLength) ||
    (typeof p.length === "string" && p.length) ||
    "—";
  p.lengthCategory =
    (typeof p.lengthCategory === "string" && p.lengthCategory.trim()) ||
    inferLengthCategory(String(p.dressLength ?? ""));
  p.fabricTexture =
    (typeof p.fabricTexture === "string" && p.fabricTexture) ||
    (typeof p.fabric === "string" && p.fabric) ||
    "—";
  const matchAnchors = asStringArray(p.matchAnchors);
  const distinctiveDetails = asStringArray(p.distinctiveDetails ?? p.uniqueDetails);
  p.embellishments = asStringArray(p.embellishments);
  p.matchKeywords = asStringArray(p.matchKeywords);
  p.garmentType =
    (typeof p.garmentType === "string" && p.garmentType.trim()) ||
    (typeof p.category === "string" && p.category.trim()) ||
    "—";
  p.category = (typeof p.category === "string" && p.category.trim()) || p.garmentType;
  p.neckline = (typeof p.neckline === "string" && p.neckline.trim()) || "—";
  p.sleeves = (typeof p.sleeves === "string" && p.sleeves.trim()) || "—";
  p.sleeveType =
    (typeof p.sleeveType === "string" && p.sleeveType.trim()) || p.sleeves;
  p.dominantColorFamily =
    (typeof p.dominantColorFamily === "string" && p.dominantColorFamily.trim()) ||
    asStringArray(p.primaryColors)[0] ||
    "—";
  p.colorTemperature = normalizeColorTemperature(p.colorTemperature);
  p.printScale =
    (typeof p.printScale === "string" && p.printScale.trim()) ||
    inferPrintScale(String((p.pattern as { description?: string })?.description ?? ""));
  p.notToConfuseWith =
    typeof p.notToConfuseWith === "string" ? p.notToConfuseWith.trim() : "";

  const summary = typeof p.visualSummary === "string" ? p.visualSummary.trim() : "";
  const fingerprint =
    typeof p.distinguishingFingerprint === "string" ? p.distinguishingFingerprint.trim() : "";
  if (!summary && fingerprint) p.visualSummary = fingerprint;
  if (!fingerprint && summary) p.distinguishingFingerprint = summary.slice(0, 280);

  if (matchAnchors.length === 0 && distinctiveDetails.length > 0) {
    p.matchAnchors = distinctiveDetails.slice(0, 6);
  } else {
    p.matchAnchors = matchAnchors;
  }
  p.distinctiveDetails = distinctiveDetails;

  p.primaryColors = asStringArray(p.primaryColors);
  p.secondaryColors = asStringArray(p.secondaryColors);

  if (p.version !== 1) p.version = 1;
  if (!p.referenceLabel) p.referenceLabel = label || "unknown";

  return p;
}

function normalizeColorTemperature(value: unknown): string {
  const v = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (v === "warm" || v === "cool" || v === "neutral") return v;
  return "neutral";
}

function inferLengthCategory(dressLength: string): string {
  const t = dressLength.toLowerCase();
  if (/mini|curto|above knee/i.test(t)) return "mini";
  if (/knee|joelho/i.test(t)) return "knee";
  if (/midi|mid/i.test(t)) return "midi";
  if (/maxi|long|longo|floor|ankle|tornozelo/i.test(t)) return "maxi";
  return "other";
}

function inferPrintScale(patternDesc: string): string {
  const t = patternDesc.toLowerCase();
  if (/solid|liso|plain|sem estampa/i.test(t)) return "solid";
  if (/micro|tiny|pequen/i.test(t)) return "micro";
  if (/large|grande|oversized/i.test(t)) return "large";
  if (/all-over|all over|total/i.test(t)) return "all-over";
  if (/floral|estamp|print|pattern/i.test(t)) return "medium";
  return "other";
}

export class IncompleteCatalogProfileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IncompleteCatalogProfileError";
  }
}

/** Rejeita perfis vazios/inúteis para match — força próximo modelo na cadeia OpenRouter. */
export function assertCatalogProfileComplete(profile: Record<string, unknown>): void {
  const primary = asStringArray(profile.primaryColors);
  const secondary = asStringArray(profile.secondaryColors);
  const keywords = asStringArray(profile.matchKeywords);
  const anchors = asStringArray(profile.matchAnchors);
  const summary = String(profile.visualSummary ?? "").trim();
  const fingerprint = String(profile.distinguishingFingerprint ?? "").trim();
  const garment = String(profile.garmentType ?? "").trim();
  const dominant = String(profile.dominantColorFamily ?? "").trim();

  if (primary.length === 0 && secondary.length === 0) {
    throw new IncompleteCatalogProfileError(
      "Perfil JSON incompleto: faltam cores (primaryColors/secondaryColors)."
    );
  }
  if (dominant.length < 3 || dominant === "—") {
    throw new IncompleteCatalogProfileError(
      "Perfil JSON incompleto: dominantColorFamily ausente ou genérico."
    );
  }
  if (keywords.length < 5) {
    throw new IncompleteCatalogProfileError(
      "Perfil JSON incompleto: matchKeywords insuficientes (mín. 5)."
    );
  }
  if (anchors.length < 4) {
    throw new IncompleteCatalogProfileError(
      "Perfil JSON incompleto: matchAnchors insuficientes (mín. 4)."
    );
  }
  if (summary.length < 40 && fingerprint.length < 25) {
    throw new IncompleteCatalogProfileError(
      "Perfil JSON incompleto: visualSummary e distinguishingFingerprint muito curtos."
    );
  }
  if (!garment || garment === "—") {
    throw new IncompleteCatalogProfileError(
      "Perfil JSON incompleto: garmentType/category ausente."
    );
  }
}

export function finalizeCatalogProfile(
  raw: Record<string, unknown>,
  label?: string
): Record<string, unknown> {
  const profile = coerceCatalogProfile(raw, label);
  assertCatalogProfileComplete(profile);
  return profile;
}
