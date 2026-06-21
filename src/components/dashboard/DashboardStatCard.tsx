import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";

export function DashboardStatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "accent",
  className,
  style,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: "accent" | "success" | "warning" | "neutral";
  className?: string;
  style?: React.CSSProperties;
}) {
  const toneClasses = {
    accent: "text-ag-accent",
    success: "text-ag-success",
    warning: "text-ag-warning",
    neutral: "text-ag-text",
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-ag-border/60 bg-ag-surface-1 p-4 shadow-[var(--ag-shadow)]",
        "transition-all hover:border-ag-accent/30 hover:shadow-[var(--ag-shadow-lg)]",
        "animate-ag-fade-in",
        className
      )}
      style={style}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-mono uppercase tracking-widest text-ag-muted">{label}</p>
          <p
            className={cn(
              "mt-2 font-display text-3xl font-semibold tabular-nums tracking-tight",
              toneClasses[tone]
            )}
          >
            {value}
          </p>
          {hint && <p className="mt-1.5 text-xs text-ag-muted leading-relaxed">{hint}</p>}
        </div>
        {Icon && (
          <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-xl bg-ag-accent-soft text-ag-accent">
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}
