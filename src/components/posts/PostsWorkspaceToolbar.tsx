import { CalendarDays, FileText, LayoutList } from "lucide-react";
import { cn } from "../../lib/cn";

export function PostsWorkspaceToolbar({
  viewMode,
  onViewModeChange,
  onExportTxt,
}: {
  viewMode: "split" | "editorial";
  onViewModeChange: (mode: "split" | "editorial") => void;
  onExportTxt: () => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-1">
      <div className="inline-flex p-1 rounded-xl bg-ag-surface-2/80 border border-ag-border/80 backdrop-blur-sm">
        {(
          [
            { id: "split" as const, label: "Estúdio", icon: LayoutList },
            { id: "editorial" as const, label: "Grade 30 dias", icon: CalendarDays },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onViewModeChange(id)}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all duration-200",
              viewMode === id
                ? "bg-ag-surface-1 text-ag-text shadow-sm ring-1 ring-ag-border"
                : "text-ag-muted hover:text-ag-text"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onExportTxt}
        className="text-xs font-medium px-4 py-2 rounded-xl border border-ag-border/80 bg-ag-surface-1/80 hover:bg-ag-surface-2 flex items-center justify-center gap-2 cursor-pointer text-ag-text transition-colors"
      >
        <FileText className="h-3.5 w-3.5 text-ag-accent" />
        Exportar planejamento
      </button>
    </div>
  );
}
