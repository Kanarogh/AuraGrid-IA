import { Check } from "lucide-react";
import { cn } from "../../lib/cn";

export type WorkflowStep = {
  id: string;
  label: string;
  description?: string;
  done: boolean;
  active?: boolean;
};

export function WorkflowStepper({
  steps,
  className,
  ariaLabel = "Progresso do fluxo",
}: {
  steps: WorkflowStep[];
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <ol
      className={cn(
        "grid gap-2 sm:grid-cols-2 lg:grid-cols-4 rounded-xl border border-ag-border/60 bg-ag-surface-2/60 p-3",
        className
      )}
      aria-label={ariaLabel}
    >
      {steps.map((step, index) => (
        <li
          key={step.id}
          className={cn(
            "flex items-start gap-2.5 rounded-lg px-2.5 py-2 transition-colors",
            step.active && "bg-ag-accent/8 ring-1 ring-ag-accent/20",
            step.done && !step.active && "opacity-90"
          )}
        >
          <span
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold mt-0.5",
              step.done
                ? "bg-ag-success/15 text-ag-success ring-1 ring-ag-success/30"
                : step.active
                  ? "ag-gradient-btn text-[var(--ag-gradient-btn-fg,#ffffff)] shadow-[var(--ag-shadow)]"
                  : "bg-ag-surface-3 text-ag-muted"
            )}
            aria-hidden
          >
            {step.done ? <Check className="h-3 w-3" /> : index + 1}
          </span>
          <div className="min-w-0">
            <p
              className={cn(
                "text-xs font-semibold leading-tight",
                step.done ? "text-ag-success" : step.active ? "ag-gradient-text" : "text-ag-text"
              )}
            >
              {step.label}
            </p>
            {step.description ? (
              <p className="text-[11px] text-ag-muted mt-0.5 leading-snug">{step.description}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
