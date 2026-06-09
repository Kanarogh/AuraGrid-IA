import { CalendarDays, FileText, LayoutList } from "lucide-react";
import { Button } from "../ui/Button";
import { SegmentedControl } from "../ui/SegmentedControl";

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
      <SegmentedControl
        value={viewMode}
        onChange={onViewModeChange}
        options={[
          { id: "split", label: "Estúdio", icon: LayoutList },
          { id: "editorial", label: "Grade 30 dias", icon: CalendarDays },
        ]}
      />

      <Button variant="secondary" size="md" onClick={onExportTxt}>
        <FileText className="h-3.5 w-3.5 text-ag-accent" />
        Exportar planejamento
      </Button>
    </div>
  );
}
