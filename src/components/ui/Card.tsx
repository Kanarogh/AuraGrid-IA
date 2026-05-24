import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  padding?: "none" | "sm" | "md" | "lg";
  variant?: "default" | "muted" | "elevated";
};

const paddingMap = {
  none: "",
  sm: "p-4",
  md: "p-5 sm:p-6",
  lg: "p-6 sm:p-8",
};

const variantMap = {
  default: "ag-card",
  muted: "rounded-[var(--radius-ag-xl)] border border-ag-border bg-ag-surface-2",
  elevated: "ag-card shadow-[var(--ag-shadow-lg)]",
};

export function Card({
  children,
  padding = "md",
  variant = "default",
  className,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        variantMap[variant],
        paddingMap[padding],
        "text-ag-text transition-colors duration-300",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5 pb-4 border-b border-ag-border">
      <div className="flex items-start gap-3 min-w-0">
        {icon && (
          <div className="shrink-0 p-2.5 rounded-xl bg-ag-accent-soft text-ag-accent">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h2 className="font-display text-xl font-semibold tracking-tight text-ag-text">
            {title}
          </h2>
          {description && (
            <p className="text-sm text-ag-muted mt-1 leading-relaxed">{description}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
