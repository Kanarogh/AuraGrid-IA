import type { CatalogItem } from "../types";
import {
  formatCatalogLabel,
  getFileRelativePath,
  isGenericPhotoName,
  referenceLabelFromFolderAndFile,
} from "./catalogImageUpload";

export type CatalogReferenceHint = {
  matchedCatalogId?: string | null;
  label?: string | null;
  /** Quando true, ignora hints de label (regenerar com match visual). */
  forceFullMatch?: boolean;
};

export type KnownCatalogReferenceResult =
  | {
      status: "known";
      item: { id: string; label: string };
      source: "explicit" | "label" | "canva-label" | "filename";
    }
  | { status: "ambiguous"; candidates: { id: string; label: string }[] }
  | { status: "none" };

export function normalizeCatalogLabelToken(value: string): string {
  return value.toLowerCase().replace(/[#\s._-]+/g, "").trim();
}

export function extractReferenceTokens(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const stem = trimmed.replace(/\.[^/.]+$/, "");
  if (isGenericPhotoName(stem)) return [];

  const tokens = new Set<string>();

  for (const match of trimmed.match(/\b\d{3,5}\b/g) ?? []) {
    tokens.add(normalizeCatalogLabelToken(match));
  }

  for (const match of trimmed.match(/\b[A-Za-z]{2,4}[\s-]?\d{3,5}\b/gi) ?? []) {
    tokens.add(normalizeCatalogLabelToken(match));
  }

  for (const match of trimmed.match(/#[\w-]+/g) ?? []) {
    tokens.add(normalizeCatalogLabelToken(match.replace(/^#/, "")));
  }

  const normFull = normalizeCatalogLabelToken(trimmed);
  if (normFull.length >= 3) {
    tokens.add(normFull);
  }

  return [...tokens].filter((t) => t.length >= 3);
}

export function labelHintFromFile(file: File): string {
  const rel = getFileRelativePath(file);
  if (rel.includes("/")) {
    return referenceLabelFromFolderAndFile(file);
  }
  const stem = file.name.replace(/\.[^/.]+$/, "");
  if (isGenericPhotoName(stem)) return "";
  return formatCatalogLabel(stem);
}

export function findCatalogMatchesByHint(
  catalog: { id: string; label: string }[],
  hint: string
): { id: string; label: string; score: number }[] {
  const normHint = normalizeCatalogLabelToken(hint);
  if (!normHint) return [];

  const results: { id: string; label: string; score: number }[] = [];

  for (const item of catalog) {
    const normLabel = normalizeCatalogLabelToken(item.label);
    let score = 0;

    if (normLabel === normHint) {
      score = 95;
    } else if (normLabel.includes(normHint) || normHint.includes(normLabel)) {
      score = 75;
    } else {
      for (const token of extractReferenceTokens(hint)) {
        if (normLabel === token) score = Math.max(score, 90);
        else if (normLabel.includes(token)) score = Math.max(score, 70);
      }
    }

    if (score > 0) {
      results.push({ id: item.id, label: item.label, score });
    }
  }

  return results.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
}

export function resolveKnownCatalogReference(
  catalog: { id: string; label: string }[],
  hints: CatalogReferenceHint
): KnownCatalogReferenceResult {
  if (hints.matchedCatalogId) {
    const explicit = catalog.find((c) => c.id === hints.matchedCatalogId);
    if (explicit) {
      return { status: "known", item: explicit, source: "explicit" };
    }
  }

  if (hints.forceFullMatch) {
    return { status: "none" };
  }

  const labelHints = [hints.label].filter((h): h is string => !!h?.trim());
  const byId = new Map<string, { id: string; label: string; score: number }>();

  for (const hint of labelHints) {
    for (const match of findCatalogMatchesByHint(catalog, hint)) {
      const prev = byId.get(match.id);
      if (!prev || match.score > prev.score) {
        byId.set(match.id, match);
      }
    }
  }

  const candidates = [...byId.values()].sort(
    (a, b) => b.score - a.score || a.label.localeCompare(b.label)
  );

  if (candidates.length === 0) {
    return { status: "none" };
  }

  const top = candidates[0]!;
  const second = candidates[1];

  if (top.score >= 90 && (!second || top.score - second.score >= 10)) {
    return {
      status: "known",
      item: { id: top.id, label: top.label },
      source: hints.label ? "canva-label" : "label",
    };
  }

  if (candidates.length === 1 && top.score >= 70) {
    return {
      status: "known",
      item: { id: top.id, label: top.label },
      source: "label",
    };
  }

  const close = candidates.filter((c) => top.score - c.score <= 15 && c.score >= 70);
  if (close.length > 1) {
    return {
      status: "ambiguous",
      candidates: close.map((c) => ({ id: c.id, label: c.label })),
    };
  }

  if (top.score >= 85) {
    return {
      status: "known",
      item: { id: top.id, label: top.label },
      source: "label",
    };
  }

  return { status: "none" };
}

/** Auto-vínculo no upload: só retorna id quando a referência é única. */
export function resolveCatalogIdForUpload(
  catalog: CatalogItem[],
  labelHint: string
): string | null {
  const resolved = resolveKnownCatalogReference(
    catalog.map((c) => ({ id: c.id, label: c.label })),
    { label: labelHint }
  );
  return resolved.status === "known" ? resolved.item.id : null;
}

/** Resolve id a partir do nome/caminho do arquivo de upload. */
export function resolveCatalogIdFromFile(catalog: CatalogItem[], file: File): string | null {
  const hint = labelHintFromFile(file);
  if (!hint) return null;
  return resolveCatalogIdForUpload(catalog, hint);
}

export async function pickCatalogReferenceFromCandidates(
  candidates: { id: string; label: string }[],
  promptDialogFn: (options: {
    title?: string;
    message?: string;
    defaultValue?: string;
    placeholder?: string;
    confirmLabel?: string;
    cancelLabel?: string;
  }) => Promise<string | null>
): Promise<{ id: string; label: string } | null> {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0]!;

  const lines = candidates.map((c, i) => `${i + 1}. ${c.label}`).join("\n");
  const answer = await promptDialogFn({
    title: "Escolher referência",
    message: `Várias referências batem com este nome:\n\n${lines}\n\nDigite o número (1–${candidates.length}):`,
    defaultValue: "1",
    placeholder: "1",
    confirmLabel: "Usar referência",
    cancelLabel: "Cancelar",
  });

  if (!answer) return null;
  const index = Number.parseInt(answer.trim(), 10);
  if (!Number.isFinite(index) || index < 1 || index > candidates.length) {
    return null;
  }
  return candidates[index - 1] ?? null;
}
