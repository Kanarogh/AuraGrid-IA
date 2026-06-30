import type { AppSection } from "../../lib/sectionMeta";
import { ALL_NAV_ITEMS, isAppSectionVisible } from "../../lib/sectionMeta";
import { filterNavSections } from "../../lib/permissions/navFilter";
import { useAuth } from "../../context/AuthContext";
import { cn } from "../../lib/cn";
import { ChevronRight } from "lucide-react";

const QUICK_SECTIONS: AppSection[] = [
  "content_schedule",
  "posts",
  "post_scheduling",
  "canva_grid",
  "feed_simulator",
  "catalog",
  "settings",
  "reference_finder",
];

export function DashboardQuickActions({
  onNavigateSection,
  usesReferences = true,
  activeClientId,
}: {
  onNavigateSection: (section: AppSection) => void;
  usesReferences?: boolean;
  activeClientId?: string | null;
}) {
  const { user } = useAuth();
  const allowed =
    activeClientId && user
      ? filterNavSections(user, activeClientId, QUICK_SECTIONS)
      : QUICK_SECTIONS;
  const items = allowed
    .filter((id) => isAppSectionVisible(id))
    .filter((id) => usesReferences || id !== "reference_finder")
    .map((id) => ALL_NAV_ITEMS.find((i) => i.id === id)!)
    .filter(Boolean);

  return (
    <section className="space-y-3 animate-ag-fade-in">
      <div>
        <p className="text-[10px] font-mono uppercase tracking-widest text-ag-accent">
          Atalhos
        </p>
        <h2 className="font-display text-lg font-semibold text-ag-text mt-1">
          Ir direto para uma área
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigateSection(item.id)}
              className={cn(
                "group flex items-center gap-3 rounded-xl border border-ag-border/60 bg-ag-surface-1",
                "px-4 py-3.5 text-left transition-all cursor-pointer ag-focus-ring",
                "hover:border-ag-accent/30 hover:shadow-[var(--ag-shadow-lg)] animate-ag-fade-in"
              )}
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ag-accent-soft text-ag-accent group-hover:bg-ag-accent group-hover:text-ag-accent-fg transition-colors">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ag-text truncate">{item.label}</p>
                <p className="text-xs text-ag-muted truncate mt-0.5">{item.description}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-ag-muted shrink-0 group-hover:text-ag-accent transition-colors" />
            </button>
          );
        })}
      </div>
    </section>
  );
}
