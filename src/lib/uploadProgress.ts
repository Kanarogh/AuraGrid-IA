export function formatUploadBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatUploadEta(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) {
    return "Calculando tempo restante…";
  }
  if (seconds < 45) return `~${Math.max(1, Math.ceil(seconds))} s restantes`;
  const minutes = Math.ceil(seconds / 60);
  return `~${minutes} min restante${minutes > 1 ? "s" : ""}`;
}

/** ETA com base no ritmo médio por arquivo (inclui fração do arquivo atual). */
export function estimateUploadEtaSeconds(
  startedAt: number,
  total: number,
  currentIndex: number,
  filePercent: number
): number | null {
  if (total <= 0 || currentIndex < 1) return null;
  const completed = currentIndex - 1 + Math.min(1, Math.max(0, filePercent) / 100);
  if (completed < 0.15) return null;
  const elapsedSec = (Date.now() - startedAt) / 1000;
  const perUnit = elapsedSec / completed;
  const remaining = total - completed;
  return Math.max(0, remaining * perUnit);
}

export function computeOverallUploadPercent(
  total: number,
  currentIndex: number,
  filePercent: number
): number {
  if (total <= 0) return 0;
  const unit = currentIndex - 1 + Math.min(1, Math.max(0, filePercent) / 100);
  return Math.min(100, Math.round((unit / total) * 100));
}
