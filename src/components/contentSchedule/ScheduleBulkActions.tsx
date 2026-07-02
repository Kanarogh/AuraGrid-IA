import { Copy, Download, Loader2, Send, Trash2 } from "lucide-react";
import { Button } from "../ui/Button";
import { WorkspaceCard } from "../layout/WorkspaceCard";

type ScheduleBulkActionsProps = {
  isReadOnly?: boolean;
  approvedCount: number;
  exportingPdf: boolean;
  exportingDocx: boolean;
  onClearSchedule: () => void;
  onCopyAll: () => void;
  onExportTxt: () => void;
  onExportPdf: () => void;
  onExportDocx: () => void;
  onPushToPlanning: () => void;
};

export function ScheduleBulkActions({
  isReadOnly,
  approvedCount,
  exportingPdf,
  exportingDocx,
  onClearSchedule,
  onCopyAll,
  onExportTxt,
  onExportPdf,
  onExportDocx,
  onPushToPlanning,
}: ScheduleBulkActionsProps) {
  return (
    <WorkspaceCard variant="secondary" className="!p-3 sm:!p-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-ag-text">Ações do cronograma</p>
          <p className="text-[11px] text-ag-muted mt-0.5">
            Exporte para o time ou envie itens aprovados ao planejamento.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isReadOnly && (
            <Button type="button" variant="ghost" size="sm" onClick={onClearSchedule}>
              <Trash2 className="h-4 w-4" />
              Excluir
            </Button>
          )}
          <Button type="button" variant="secondary" size="sm" onClick={onCopyAll}>
            <Copy className="h-4 w-4" />
            Copiar tudo
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={onExportTxt}>
            <Download className="h-4 w-4" />
            TXT
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onExportPdf}
            disabled={exportingPdf}
          >
            {exportingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            PDF
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onExportDocx}
            disabled={exportingDocx}
          >
            {exportingDocx ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            DOCX
          </Button>
          <Button
            type="button"
            variant="accent"
            size="sm"
            onClick={onPushToPlanning}
            disabled={isReadOnly || approvedCount === 0}
            title={approvedCount === 0 ? "Aprove itens antes de enviar" : undefined}
          >
            <Send className="h-4 w-4" />
            Enviar ao Planejamento
            {approvedCount > 0 ? ` (${approvedCount})` : ""}
          </Button>
        </div>
      </div>
    </WorkspaceCard>
  );
}
