/** Fases da indexação de catálogo — compartilhado UI + servidor. */

export const ENRICH_PROGRESS_PHASES = [
  "prepare",
  "download",
  "analyze",
  "refine",
  "save",
  "embed",
  "done",
] as const;

export type EnrichProgressPhase = (typeof ENRICH_PROGRESS_PHASES)[number];

export const ENRICH_PHASE_LABELS: Record<EnrichProgressPhase, string> = {
  prepare: "Preparando…",
  download: "Baixando foto",
  analyze: "Analisando imagem (1/2)",
  refine: "Refinando perfil (2/2)",
  save: "Salvando perfil",
  embed: "Gerando embedding",
  done: "Concluído",
};

export const ENRICH_PHASE_PERCENT: Record<EnrichProgressPhase, number> = {
  prepare: 4,
  download: 12,
  analyze: 22,
  refine: 58,
  save: 88,
  embed: 94,
  done: 100,
};

export type CatalogEnrichProgressDetail = {
  index: number;
  total: number;
  itemId: string;
  label: string;
  phase?: EnrichProgressPhase;
  itemPercent?: number;
  stepLabel?: string;
};

export function enrichStepLabel(phase?: EnrichProgressPhase): string {
  if (!phase) return "Indexando…";
  return ENRICH_PHASE_LABELS[phase] ?? "Indexando…";
}

/** Progresso global do lote (N de M + % aproximado). */
export function enrichBatchPercent(progress: CatalogEnrichProgressDetail): number {
  const { index, total, itemPercent = 0 } = progress;
  if (total <= 0) return 0;
  const base = ((index - 1) / total) * 100;
  const slice = (Math.min(100, Math.max(0, itemPercent)) / total);
  return Math.min(100, Math.round(base + slice));
}
