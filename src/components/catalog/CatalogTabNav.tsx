import { LayoutGrid, ShoppingBag } from "lucide-react";
import { cn } from "../../lib/cn";

export type CatalogTab = "references" | "grid";

export function CatalogTabNav({
  active,
  onChange,
  referenceCount,
  gridCount,
  usesReferences = true,
}: {
  active: CatalogTab;
  onChange: (tab: CatalogTab) => void;
  referenceCount: number;
  gridCount: number;
  usesReferences?: boolean;
}) {
  const tabs: { id: CatalogTab; label: string; icon: typeof ShoppingBag; count: number }[] = [
    ...(usesReferences
      ? [{ id: "references" as const, label: "Referências (IA)", icon: ShoppingBag, count: referenceCount }]
      : []),
    { id: "grid", label: "Peças de grid", icon: LayoutGrid, count: gridCount },
  ];

  return (
    <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-ag-surface-2 border border-ag-border mb-6">
      {tabs.map(({ id, label, icon: Icon, count }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ag-focus-ring",
            active === id
              ? "bg-ag-surface-1 text-ag-text shadow-[var(--ag-shadow)] border border-ag-border"
              : "text-ag-muted hover:text-ag-text border border-transparent"
          )}
        >
          <Icon className={cn("h-3.5 w-3.5", active === id && "text-ag-accent")} />
          {label}
          <span className="text-[10px] font-mono opacity-70">({count})</span>
        </button>
      ))}
    </div>
  );
}
