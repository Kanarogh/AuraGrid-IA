import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { cn } from "../../lib/cn";

export function WorkspacePageHeader({
  clientName,
  sectionTitle,
  subtitle,
  icon: Icon,
  eyebrow,
  actions,
  className,
  suppressTitle = false,
}: {
  clientName?: string;
  sectionTitle: string;
  subtitle?: string;
  icon?: LucideIcon;
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
  /** Hide H1 when AppTopBar or parent already shows the section title */
  suppressTitle?: boolean;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between pb-1",
        className
      )}
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {Icon && (
          <div className="shrink-0 mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-ag-accent-soft text-ag-accent">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0">
          {clientName && (
            <nav
              className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-ag-muted mb-1"
              aria-label="Localização"
            >
              <span className="truncate max-w-[10rem]" title={clientName}>
                {clientName}
              </span>
              <ChevronRight className="h-3 w-3 opacity-60 shrink-0" aria-hidden />
              <span className="text-ag-accent truncate">{sectionTitle}</span>
            </nav>
          )}
          {eyebrow && (
            <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-ag-accent mb-1">
              {eyebrow}
            </p>
          )}
          {!clientName && !suppressTitle && (
            <h1 className="font-display text-xl sm:text-2xl font-semibold text-ag-text tracking-tight">
              {sectionTitle}
            </h1>
          )}
          {subtitle && (
            <p className="text-sm text-ag-muted mt-1 leading-relaxed max-w-3xl">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
    </header>
  );
}
