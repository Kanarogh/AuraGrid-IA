import { Calendar, Plus, ShoppingBag, Sparkles, Upload } from "lucide-react";
import type { CatalogItem } from "../../types";
import { Button } from "../ui/Button";
import { Card, CardHeader } from "../ui/Card";
import { FieldLabel, Input } from "../ui/Input";

export function SchedulerPanel({
  startDate,
  onStartDateChange,
  postsCount,
  catalogCount,
  onAddDay,
  onDistributeCatalog,
  onBatchUpload,
}: {
  startDate: string;
  onStartDateChange: (date: string) => void;
  postsCount: number;
  catalogCount: number;
  onAddDay: () => void;
  onDistributeCatalog: () => void;
  onBatchUpload: (files: FileList) => void;
}) {
  return (
    <Card className="ag-studio relative overflow-hidden mb-4 border-ag-border/70 shadow-[var(--ag-shadow-lg)]" padding="sm">
      <CardHeader
        icon={<Calendar className="h-5 w-5" />}
        title="Distribuição automática — 30 dias"
        description="Defina a data de início e distribua looks no calendário editorial."
        action={
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ag-accent bg-ag-accent-soft px-3 py-1.5 rounded-full border border-ag-accent/20">
            <Sparkles className="h-3.5 w-3.5" />
            {postsCount} posts
          </span>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 p-5 rounded-xl bg-ag-surface-2 border border-ag-border flex flex-col justify-between gap-4">
          <div>
            <FieldLabel>Data de início</FieldLabel>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="font-semibold"
            />
            <p className="text-xs text-ag-muted mt-2 leading-relaxed">
              Os dias seguintes são calculados automaticamente a partir desta data.
            </p>
          </div>
          <Button variant="primary" size="md" onClick={onAddDay} className="w-fit">
            <Plus className="h-4 w-4" />
            Adicionar dia
          </Button>
        </div>

        <div className="lg:col-span-7 p-5 rounded-xl bg-ag-surface-2 border border-ag-border">
          <p className="text-xs font-mono uppercase tracking-wider text-ag-muted font-semibold mb-3">
            Distribuidor inteligente
          </p>
          <p className="text-sm text-ag-muted leading-relaxed mb-4">
            Distribui fotos em exatamente 30 dias. Com mais de 30 imagens, permite até 3 posts por dia nos primeiros dias.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2 p-4 rounded-xl border border-ag-border bg-ag-surface-1">
              <span className="text-[10px] font-mono uppercase text-ag-muted">Do catálogo</span>
              <p className="text-xs text-ag-muted">
                Usar <strong className="text-ag-text">{catalogCount}</strong> referências do guarda-roupa.
              </p>
              <Button
                variant="accent"
                size="sm"
                onClick={onDistributeCatalog}
                disabled={catalogCount === 0}
                className="mt-1"
              >
                <ShoppingBag className="h-3.5 w-3.5" />
                Distribuir catálogo
              </Button>
            </div>

            <div className="flex flex-col gap-2 p-4 rounded-xl border border-ag-border bg-ag-surface-1">
              <span className="text-[10px] font-mono uppercase text-ag-muted">Upload em lote</span>
              <p className="text-xs text-ag-muted">Novas imagens do Canva direto no calendário.</p>
              <input
                type="file"
                id="smart-scheduler-file-picker"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) onBatchUpload(e.target.files);
                }}
              />
              <Button
                variant="secondary"
                size="sm"
                className="mt-1"
                onClick={() =>
                  document.getElementById("smart-scheduler-file-picker")?.click()
                }
              >
                <Upload className="h-3.5 w-3.5 text-ag-accent" />
                Upload e agendar
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
