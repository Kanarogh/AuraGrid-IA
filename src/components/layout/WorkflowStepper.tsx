import { Check } from "lucide-react";
import { cn } from "../../lib/cn";

export type WorkflowStep = {
  id: string;
  label: string;
  done: boolean;
  active?: boolean;
};

export function WorkflowStepper({
  steps,
  className,
}: {
  steps: WorkflowStep[];
  className?: string;
}) {
  return (
    <ol
      className={cn(
        "flex flex-wrap items-center gap-2 sm:gap-0 sm:divide-x sm:divide-ag-border/60 rounded-xl border border-ag-border/60 bg-ag-surface-2/60 px-3 py-2.5",
        className
      )}
      aria-label="Progresso do roteiro"
    >
      {steps.map((step, index) => (
        <li
          key={step.id}
          className={cn(
            "flex items-center gap-2 text-xs font-medium sm:px-3 first:sm:pl-0 last:sm:pr-0",
            step.done ? "text-ag-success" : step.active ? "ag-gradient-text" : "text-ag-muted"
          )}
        >
          <span
            className={cn(
              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
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
          <span>{step.label}</span>
        </li>
      ))}
    </ol>
  );
}
