import { Loader2, Sparkles } from "lucide-react";
import { WorkspaceCard } from "../layout/WorkspaceCard";

const STEPS = [
  "Lendo briefing e temas obrigatórios",
  "Gerando posts de arte e stories",
  "Aplicando regras de copy e aderência",
  "Finalizando cronograma",
];

export function ScheduleGeneratingState({
  postCount,
  storyCount,
}: {
  postCount: number;
  storyCount: number;
}) {
  return (
    <div aria-busy="true" aria-live="polite">
      <WorkspaceCard variant="primary" className="border-ag-accent/30 bg-ag-accent/5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ag-gradient-btn text-[var(--ag-gradient-btn-fg,#ffffff)]">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ag-text">Gerando cronograma com IA…</p>
          <p className="text-xs text-ag-muted mt-1">
            Criando {postCount} posts e {storyCount} stories. Isso pode levar alguns segundos.
          </p>
          <ul className="mt-3 space-y-1.5">
            {STEPS.map((step, i) => (
              <li key={step} className="flex items-center gap-2 text-xs text-ag-muted">
                <Sparkles
                  className={cnPulse(i === 0)}
                  aria-hidden
                />
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      </WorkspaceCard>
    </div>
  );
}

function cnPulse(first: boolean) {
  return `h-3 w-3 shrink-0 text-ag-accent ${first ? "animate-pulse" : "opacity-50"}`;
}

export function ScheduleBoardSkeleton() {
  return (
    <div
      className="grid gap-4 lg:grid-cols-2"
      aria-hidden
      aria-busy="true"
    >
      {[0, 1].map((col) => (
        <div
          key={col}
          className="rounded-xl border border-ag-border/60 bg-ag-surface-2/40 p-4 space-y-3 animate-pulse"
        >
          <div className="h-4 w-32 rounded bg-ag-surface-3" />
          {[0, 1, 2].map((row) => (
            <div key={row} className="rounded-lg border border-ag-border/40 p-3 space-y-2">
              <div className="h-3 w-24 rounded bg-ag-surface-3" />
              <div className="h-3 w-full rounded bg-ag-surface-3/80" />
              <div className="h-3 w-2/3 rounded bg-ag-surface-3/60" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
