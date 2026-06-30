import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";
import { WorkspacePageHeader } from "./WorkspacePageHeader";

export function WorkspaceHero({
  sectionTitle,
  subtitle,
  titleHint,
  titleHintTooltip,
  icon,
  eyebrow,
  clientName,
  actions,
  suppressTitle = false,
  className,
  children,
}: {
  sectionTitle: string;
  subtitle?: string;
  titleHint?: string;
  titleHintTooltip?: string;
  icon?: LucideIcon;
  eyebrow?: string;
  clientName?: string;
  actions?: ReactNode;
  suppressTitle?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-ag-border/70 bg-ag-surface-1 shadow-[var(--ag-shadow-lg)] p-5 sm:p-6 animate-ag-fade-in",
        className
      )}
    >
      <WorkspacePageHeader
        clientName={clientName}
        sectionTitle={sectionTitle}
        subtitle={subtitle}
        titleHint={titleHint}
        titleHintTooltip={titleHintTooltip}
        icon={icon}
        eyebrow={eyebrow}
        actions={actions}
        suppressTitle={suppressTitle}
      />
      {children}
    </section>
  );
}
