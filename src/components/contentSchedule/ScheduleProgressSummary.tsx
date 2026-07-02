import { WorkspaceCard } from "../layout/WorkspaceCard";

export function ScheduleProgressSummary({
  total,
  draftCount,
  approvedCount,
  doneCount,
  postsCount,
  storiesCount,
}: {
  total: number;
  draftCount: number;
  approvedCount: number;
  doneCount: number;
  postsCount: number;
  storiesCount: number;
}) {
  const pctApproved = total > 0 ? Math.round((approvedCount / total) * 100) : 0;
  const pctDone = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  return (
    <WorkspaceCard variant="secondary" className="!p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-ag-text">Progresso do cronograma</p>
          <p className="text-xs text-ag-muted mt-0.5">
            {postsCount} posts · {storiesCount} stories · {total} itens no total
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          <StatPill label="Rascunho" value={draftCount} tone="neutral" />
          <StatPill label="Aprovados" value={approvedCount} tone="success" />
          <StatPill label="Entregues" value={doneCount} tone="accent" />
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <ProgressBar label="Aprovação" percent={pctApproved} />
        <ProgressBar label="Entrega" percent={pctDone} />
      </div>
    </WorkspaceCard>
  );
}

function StatPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "success" | "accent";
}) {
  const toneClass =
    tone === "success"
      ? "text-ag-success bg-ag-success/10"
      : tone === "accent"
        ? "text-ag-accent bg-ag-accent/10"
        : "text-ag-muted bg-ag-surface-3";
  return (
    <span className={cnPill(toneClass)}>
      <span className="font-medium">{value}</span> {label}
    </span>
  );
}

function cnPill(toneClass: string) {
  return `inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${toneClass}`;
}

function ProgressBar({ label, percent }: { label: string; percent: number }) {
  return (
    <div>
      <div className="flex justify-between text-[10px] text-ag-muted mb-1">
        <span>{label}</span>
        <span>{percent}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-ag-surface-3 overflow-hidden">
        <div
          className="h-full rounded-full ag-gradient-btn transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
