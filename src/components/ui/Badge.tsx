import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

export function Badge({
  children,
  tone = "neutral",
  className,
  dot,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
  dot?: boolean;
}) {
  const tones: Record<BadgeTone, string> = {
    neutral: "bg-ag-surface-2 text-ag-muted border-ag-border",
    accent: "bg-ag-accent-soft text-ag-accent border-ag-accent/20",
    success: "bg-ag-success/10 text-ag-success border-ag-success/25",
    warning: "bg-ag-warning/10 text-ag-warning border-ag-warning/25",
    danger: "bg-ag-danger/10 text-ag-danger border-ag-danger/25",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border",
        tones[tone],
        className
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />}
      {children}
    </span>
  );
}
