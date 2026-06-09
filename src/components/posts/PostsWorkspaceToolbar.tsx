import { CalendarDays, FileDown, FileText, LayoutList, Loader2 } from "lucide-react";
import { Button } from "../ui/Button";
import { SegmentedControl } from "../ui/SegmentedControl";

export function PostsWorkspaceToolbar({
  viewMode,
  onViewModeChange,
  onExportTxt,
  onExportPdf,
  isExportingPdf,
}: {
  viewMode: "split" | "editorial";
  onViewModeChange: (mode: "split" | "editorial") => void;
  onExportTxt: () => void;
  onExportPdf: () => void;
  isExportingPdf?: boolean;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-1">
      <SegmentedControl
        value={viewMode}
        onChange={onViewModeChange}
        options={[
          { id: "split", label: "Estúdio", icon: LayoutList },
          { id: "editorial", label: "Grade 30 dias", icon: CalendarDays },
        ]}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="accent"
          size="md"
          onClick={onExportPdf}
          disabled={isExportingPdf}
        >
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
