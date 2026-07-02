import { Check, ChevronDown } from "lucide-react";
import { cn } from "../../lib/cn";

export type WorkflowStep = {
  id: string;
  label: string;
  description?: string;
  done: boolean;
  active?: boolean;
  /** Destaca o passo como selecionado (ex.: painel briefing aberto) */
  selected?: boolean;
};

export function WorkflowStepper({
  steps,
  className,
  ariaLabel = "Progresso do fluxo",
  onStepClick,
}: {
  steps: WorkflowStep[];
  className?: string;
  ariaLabel?: string;
  onStepClick?: (stepId: string) => void;
}) {
  return (
    <ol
      className={cn(
        "grid gap-2 sm:grid-cols-2 lg:grid-cols-4 rounded-xl border border-ag-border/60 bg-ag-surface-2/60 p-3",
        className
      )}
      aria-label={ariaLabel}
    >
      {steps.map((step, index) => {
        const clickable = Boolean(onStepClick);
        const Tag = clickable ? "button" : "div";
        return (
          <li key={step.id}>
            <Tag
              type={clickable ? "button" : undefined}
              onClick={clickable ? () => onStepClick?.(step.id) : undefined}
              className={cn(
                "flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                step.active && "bg-ag-accent/8 ring-1 ring-ag-accent/20",
                step.selected && "ring-2 ring-ag-accent/40 bg-ag-accent/10",
                step.done && !step.active && !step.selected && "opacity-90",
                clickable && "hover:bg-ag-surface-3/60 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ag-accent/50"
              )}
              aria-current={step.selected ? "step" : step.active ? "step" : undefined}
              title={
                clickable && step.id === "brief"
                  ? "Clique para abrir ou fechar o briefing"
                  : clickable && step.id === "gen"
                    ? "Clique para abrir o briefing e regenerar o cronograma"
                    : undefined
              }
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold mt-0.5",
                  step.done
                    ? "bg-ag-success/15 text-ag-success ring-1 ring-ag-success/30"
                    : step.active || step.selected
                      ? "ag-gradient-btn text-[var(--ag-gradient-btn-fg,#ffffff)] shadow-[var(--ag-shadow)]"
                      : "bg-ag-surface-3 text-ag-muted"
                )}
                aria-hidden
              >
                {step.done ? <Check className="h-3 w-3" /> : index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-xs font-semibold leading-tight flex items-center gap-1",
                    step.done ? "text-ag-success" : step.active || step.selected ? "ag-gradient-text" : "text-ag-text"
                  )}
                >
                  {step.label}
                  {(step.id === "brief" || step.id === "gen") && step.selected && (
                    <ChevronDown className="h-3 w-3 text-ag-accent shrink-0" aria-hidden />
                  )}
                </p>
                {step.description ? (
                  <p className="text-[11px] text-ag-muted mt-0.5 leading-snug">{step.description}</p>
                ) : null}
              </div>
            </Tag>
          </li>
        );
      })}
    </ol>
  );
}
