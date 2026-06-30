import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { WorkspacePageHeader } from "../layout/WorkspacePageHeader";

export type StudioSectionTitleMode = "hidden" | "nested" | "full";

export function StudioSection({
  title,
  subtitle,
  eyebrow,
  icon,
  actions,
  children,
  className,
  noPadding,
  titleMode = "full",
}: {
  title?: string;
  subtitle?: ReactNode;
  eyebrow?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
  titleMode?: StudioSectionTitleMode;
}) {
  const showHeader =
    titleMode === "full" ||
    titleMode === "nested" ||
    Boolean(eyebrow || icon || actions);

  const renderHeaderBody = () => {
    if (titleMode === "hidden") {
      if (!eyebrow && !icon) return null;
      return (
        <div className="flex items-start gap-3 min-w-0">
          {icon && (
            <div className="shrink-0 mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-ag-accent-soft text-ag-accent">
              {icon}
            </div>
          )}
          {eyebrow && (
            <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-ag-accent">
              {eyebrow}
            </p>
          )}
        </div>
      );
    }

    if (titleMode === "nested") {
      return (
        <WorkspacePageHeader
          sectionTitle={title ?? ""}
          eyebrow={eyebrow}
          suppressTitle
          className="pb-0 flex-1"
        />
      );
    }

    return (
      <div className="flex items-start gap-3 min-w-0">
        {icon && (
          <div className="shrink-0 mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-ag-accent-soft text-ag-accent">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-ag-accent mb-1">
              {eyebrow}
            </p>
          )}
          {title && (
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-ag-text tracking-tight">
              {title}
            </h2>
          )}
          {subtitle && (
            <div className="text-sm text-ag-muted mt-1.5 leading-relaxed max-w-3xl">{subtitle}</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <section
      className={cn(
        "ag-studio relative w-full overflow-hidden rounded-xl border border-ag-border/70 shadow-[var(--ag-shadow-lg)] animate-ag-fade-in",
        className
      )}
    >
      <div className="ag-studio-mesh absolute inset-0 pointer-events-none" aria-hidden />

      {showHeader && (
        <header
          className={cn(
            "relative z-10 flex flex-col sm:flex-row sm:items-start justify-between gap-4 px-5 py-4 sm:px-6 border-b border-ag-border/50 bg-[var(--ag-studio-header-bg)] backdrop-blur-sm",
            titleMode === "hidden" && !eyebrow && !icon && "sm:justify-end py-3"
          )}
        >
          {renderHeaderBody()}
          {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
        </header>
      )}

      <div className={cn("relative z-10", noPadding ? "" : "p-5 sm:p-6")}>{children}</div>
    </section>
  );
}
