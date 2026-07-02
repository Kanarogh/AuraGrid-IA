import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Copy, Download, Loader2, MoreHorizontal, Send, Trash2 } from "lucide-react";
import { Button } from "../ui/Button";
import { cn } from "../../lib/cn";

type ScheduleReviewToolbarProps = {
  total: number;
  draftCount: number;
  approvedCount: number;
  doneCount: number;
  postsCount: number;
  storiesCount: number;
  isReadOnly?: boolean;
  exportingPdf: boolean;
  exportingDocx: boolean;
  onClearSchedule: () => void;
  onCopyAll: () => void;
  onExportTxt: () => void;
  onExportPdf: () => void;
  onExportDocx: () => void;
  onPushToPlanning: () => void;
};

export function ScheduleReviewToolbar({
  total,
  draftCount,
  approvedCount,
  doneCount,
  postsCount,
  storiesCount,
  isReadOnly,
  exportingPdf,
  exportingDocx,
  onClearSchedule,
  onCopyAll,
  onExportTxt,
  onExportPdf,
  onExportDocx,
  onPushToPlanning,
}: ScheduleReviewToolbarProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!exportOpen) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [exportOpen]);

  const exporting = exportingPdf || exportingDocx;

  return (
    <div
      id="schedule-review-toolbar"
      className="flex flex-col gap-3 rounded-xl border border-ag-border/60 bg-ag-surface-2/60 px-3 py-3 sm:px-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ag-text truncate">
          {total} itens · {postsCount} posts · {storiesCount} stories
        </p>
        <p className="text-[11px] text-ag-muted mt-0.5">
          <span>{draftCount} rascunho</span>
          <span className="mx-1.5 text-ag-border">·</span>
          <span className="text-ag-success">{approvedCount} aprovados</span>
          <span className="mx-1.5 text-ag-border">·</span>
          <span>{doneCount} entregues</span>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {!isReadOnly && (
          <Button type="button" variant="ghost" size="sm" onClick={onClearSchedule}>
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">Excluir</span>
          </Button>
        )}
        <Button type="button" variant="secondary" size="sm" onClick={onCopyAll}>
          <Copy className="h-4 w-4" />
          <span className="hidden sm:inline">Copiar</span>
        </Button>

        <div className="relative" ref={menuRef}>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={exporting}
            onClick={() => setExportOpen((v) => !v)}
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Exportar
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", exportOpen && "rotate-180")} />
          </Button>
          {exportOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 min-w-[140px] rounded-lg border border-ag-border/70 bg-ag-surface-1 py-1 shadow-lg">
              <MenuItem onClick={() => { onExportTxt(); setExportOpen(false); }}>TXT</MenuItem>
              <MenuItem onClick={() => { onExportPdf(); setExportOpen(false); }} disabled={exportingPdf}>
                PDF {exportingPdf ? "…" : ""}
              </MenuItem>
              <MenuItem onClick={() => { onExportDocx(); setExportOpen(false); }} disabled={exportingDocx}>
                DOCX {exportingDocx ? "…" : ""}
              </MenuItem>
            </div>
          )}
        </div>

        <Button
          type="button"
          variant="accent"
          size="sm"
          onClick={onPushToPlanning}
          disabled={isReadOnly || approvedCount === 0}
        >
          <Send className="h-4 w-4" />
          Enviar{approvedCount > 0 ? ` (${approvedCount})` : ""}
        </Button>
      </div>
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ag-text hover:bg-ag-surface-3 disabled:opacity-50"
    >
      <MoreHorizontal className="h-3.5 w-3.5 opacity-0" aria-hidden />
      {children}
    </button>
  );
}
