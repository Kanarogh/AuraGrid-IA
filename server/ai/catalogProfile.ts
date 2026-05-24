/** Prompt e normalização compartilhados para indexação do catálogo (visão). */

export function buildEnrichCatalogPrompt(label: string, id: string): string {
  return `You are a senior fashion catalog analyst for an Indian/Madrid boutique.
Analyze this garment reference photo exhaustively. The wholesale reference code is "${label || "unknown"}" (catalog id: ${id || "n/a"}).

Create a structured visual profile JSON that another AI will use LATER to match a social media post image against this catalog WITHOUT seeing this photo again.
Be extremely specific about colors, pattern, neckline, sleeves, dress length, silhouette, fabric, embellishments, and unique details.

Set referenceLabel to "${label || "unknown"}". Set version to 1.
distinguishingFingerprint: ONE sentence with the most unique visual identifiers.
visualSummary: 2-4 sentences describing the garment for matching.
matchKeywords: 8-15 short lowercase tokens.

You MUST include every field in this exact shape (arrays must be JSON arrays, never omitted):
{
  "version": 1,
  "referenceLabel": string,
  "garmentType": string,
  "category": string,
  "primaryColors": [string, ...],
  "secondaryColors": [string, ...],
  "pattern": { "type": string, "description": string },
  "neckline": string,
  "sleeves": string,
  "dressLength": string,
  "silhouette": string,
  "fabricTexture": string,
  "embellishments": [string, ...],
  "distinctiveDetails": [string, ...],
  "matchKeywords": [string, ...],
  "visualSummary": string,
  "distinguishingFingerprint": string
}`;
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
  p.fabricTexture =
    (typeof p.fabricTexture === "string" && p.fabricTexture) ||
    (typeof p.fabric === "string" && p.fabric) ||
    "—";
  p.distinctiveDetails = asStringArray(p.distinctiveDetails ?? p.uniqueDetails);
  p.embellishments = asStringArray(p.embellishments);
  p.matchKeywords = asStringArray(p.matchKeywords);
  p.garmentType =
    (typeof p.garmentType === "string" && p.garmentType.trim()) ||
    (typeof p.category === "string" && p.category.trim()) ||
    "—";
  p.category = (typeof p.category === "string" && p.category.trim()) || p.garmentType;
  p.neckline = (typeof p.neckline === "string" && p.neckline.trim()) || "—";
  p.sleeves = (typeof p.sleeves === "string" && p.sleeves.trim()) || "—";
  p.silhouette = (typeof p.silhouette === "string" && p.silhouette.trim()) || "—";

  const summary = typeof p.visualSummary === "string" ? p.visualSummary.trim() : "";
  const fingerprint =
    typeof p.distinguishingFingerprint === "string" ? p.distinguishingFingerprint.trim() : "";
  if (!summary && fingerprint) p.visualSummary = fingerprint;
  if (!fingerprint && summary) p.distinguishingFingerprint = summary.slice(0, 280);

  p.primaryColors = asStringArray(p.primaryColors);
  p.secondaryColors = asStringArray(p.secondaryColors);

  if (p.version !== 1) p.version = 1;
  if (!p.referenceLabel) p.referenceLabel = label || "unknown";

  return p;
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
  const summary = String(profile.visualSummary ?? "").trim();
  const fingerprint = String(profile.distinguishingFingerprint ?? "").trim();
  const garment = String(profile.garmentType ?? "").trim();

  if (primary.length === 0 && secondary.length === 0) {
    throw new IncompleteCatalogProfileError(
      "Perfil JSON incompleto: faltam cores (primaryColors/secondaryColors)."
    );
  }
  if (keywords.length < 3) {
    throw new IncompleteCatalogProfileError(
      "Perfil JSON incompleto: matchKeywords insuficientes (mín. 3)."
    );
  }
  if (summary.length < 20 && fingerprint.length < 12) {
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
