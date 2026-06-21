import { Calendar, Plus, Sparkles, Upload } from "lucide-react";
import { Button } from "../ui/Button";
import { Card, CardHeader } from "../ui/Card";
import { FieldLabel, Input } from "../ui/Input";
import { cn } from "../../lib/cn";

export function SchedulerPanel({
  startDate,
  onStartDateChange,
  postsCount,
  onAddDay,
  onBatchUpload,
  isReadOnly = false,
  embedded = false,
}: {
  startDate: string;
  onStartDateChange: (date: string) => void;
  postsCount: number;
  onAddDay: () => void;
  onBatchUpload: (files: FileList) => void;
  isReadOnly?: boolean;
  embedded?: boolean;
}) {
  const content = (
    <>
      {!embedded && (
        <CardHeader
          icon={<Calendar className="h-5 w-5" />}
          title="Distribuição automática — 30 dias"
          description="Defina a data de início e envie fotos em lote para o calendário."
          action={
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ag-accent bg-ag-accent-soft px-3 py-1.5 rounded-full border border-ag-accent/20">
              <Sparkles className="h-3.5 w-3.5" />
              {postsCount} posts
            </span>
          }
        />
      )}

      <div className={cn("grid grid-cols-1 lg:grid-cols-12 gap-5", embedded && "gap-4")}>
        <div className="lg:col-span-5 p-5 rounded-xl bg-ag-surface-2 border border-ag-border flex flex-col justify-between gap-4">
          <div>
            <FieldLabel>Data de início</FieldLabel>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="font-semibold"
              disabled={isReadOnly}
            />
            <p className="text-xs text-ag-muted mt-2 leading-relaxed">
              Os dias seguintes são calculados automaticamente a partir desta data.
            </p>
          </div>
          <Button variant="primary" size="md" onClick={onAddDay} className="w-fit" disabled={isReadOnly}>
            <Plus className="h-4 w-4" />
            Adicionar dia
          </Button>
        </div>

        <div className="lg:col-span-7 p-5 rounded-xl bg-ag-surface-2 border border-ag-border">
          <p className="text-xs font-mono uppercase tracking-wider text-ag-muted font-semibold mb-3">
            Upload em lote
          </p>
          <p className="text-sm text-ag-muted leading-relaxed mb-4">
            Envie fotos avulsas quando ainda não montou o grid. A distribuição segue as regras da aba
            Grid Canva.
          </p>
          <div className="flex flex-col gap-2 p-4 rounded-xl border border-ag-border bg-ag-surface-1">
            <input
              type="file"
              id="smart-scheduler-file-picker"
              multiple
              accept="image/*"
              className="hidden"
              disabled={isReadOnly}
              onChange={(e) => {
                if (e.target.files?.length) onBatchUpload(e.target.files);
              }}
            />
            <Button
              variant="accent"
              size="sm"
              className="w-fit"
              disabled={isReadOnly}
              onClick={() =>
                document.getElementById("smart-scheduler-file-picker")?.click()
              }
            >
              <Upload className="h-3.5 w-3.5" />
              Upload e distribuir
            </Button>
          </div>
        </div>
      </div>
    </>
  );

  if (embedded) return content;

  return (
    <Card
      className="ag-studio relative overflow-hidden mb-4 border-ag-border/70 shadow-[var(--ag-shadow-lg)]"
      padding="sm"
    >
      {content}
    </Card>
  );
}
