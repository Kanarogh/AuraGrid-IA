import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";

export interface TabItem<T extends string> {
  id: T;
  label: string;
  icon: LucideIcon;
  badge?: string | number;
}

export function TabNav<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <nav
      className="flex flex-wrap gap-1 border-b border-ag-border mb-8"
      aria-label="Áreas do workspace"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 -mb-px text-sm font-medium transition-all cursor-pointer ag-focus-ring border-b-2",
              isActive
                ? "border-[var(--ag-brand-purple)] text-ag-text"
                : "border-transparent text-ag-muted hover:text-ag-text"
            )}
          >
            <Icon className={cn("h-4 w-4", isActive ? "text-ag-accent" : "")} />
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={cn(
                  "text-[10px] font-mono px-1.5 py-0.5 rounded-md",
                  isActive ? "bg-ag-accent-soft text-ag-accent" : "bg-ag-surface-3 text-ag-muted"
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
