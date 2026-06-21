import { CalendarDays, FileDown, FileText, LayoutList, Loader2, Settings2 } from "lucide-react";
import { Button } from "../ui/Button";
import { cn } from "../../lib/cn";

export type PostsWorkTab = "day" | "calendar" | "setup";

const TABS: { id: PostsWorkTab; label: string; icon: typeof LayoutList }[] = [
  { id: "day", label: "Dia a dia", icon: LayoutList },
  { id: "calendar", label: "Calendário", icon: CalendarDays },
  { id: "setup", label: "Setup", icon: Settings2 },
];

export function PostsWorkspaceToolbar({
  activeTab,
  onTabChange,
  onExportTxt,
  onExportPdf,
  isExportingPdf,
}: {
  activeTab: PostsWorkTab;
  onTabChange: (tab: PostsWorkTab) => void;
  onExportTxt: () => void;
  onExportPdf: () => void;
  isExportingPdf?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-ag-surface-2 border border-ag-border/60">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onTabChange(id)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ag-focus-ring",
              activeTab === id
                ? "bg-ag-surface-1 text-ag-text shadow-sm border border-ag-border"
                : "text-ag-muted hover:text-ag-text border border-transparent"
            )}
          >
            <Icon className={cn("h-3.5 w-3.5", activeTab === id && "text-ag-accent")} />
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="accent" size="md" onClick={onExportPdf} disabled={isExportingPdf}>
          {isExportingPdf ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileDown className="h-3.5 w-3.5" />
          )}
          {isExportingPdf ? "Gerando PDF…" : "Exportar PDF visual"}
        </Button>
        <Button variant="secondary" size="md" onClick={onExportTxt}>
          <FileText className="h-3.5 w-3.5 text-ag-accent" />
          Exportar .txt
        </Button>
      </div>
    </div>
  );
}
