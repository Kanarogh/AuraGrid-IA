import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export function WorkspaceCard({
  children,
  variant = "primary",
  className,
  padding = true,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "inline";
  className?: string;
  padding?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border overflow-hidden",
        variant === "primary" &&
          "border-ag-border/70 bg-ag-surface-1 shadow-[var(--ag-shadow-sm)]",
        variant === "secondary" &&
          "border-ag-border/60 bg-ag-surface-2/80 shadow-none",
        variant === "inline" && "border-ag-border/50 bg-transparent shadow-none",
        padding && "p-4 sm:p-5",
        className
      )}
    >
      {children}
    </div>
  );
}

export function WorkspaceCardHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4",
        className
      )}
    >
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-ag-text">{title}</h2>
        {subtitle && <p className="text-xs text-ag-muted mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
