"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { PlanningPeriod } from "../../lib/planningConstants";
import { defaultPlanningStartDate, periodLabelFromDate } from "../../lib/planningConstants";
import { Button } from "../ui/Button";
import { FieldLabel, Input } from "../ui/Input";
import { Modal } from "../ui/Modal";

export function NewPlanningPeriodModal({
  open,
  onClose,
  periods,
  defaultSourcePeriodId,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  periods: PlanningPeriod[];
  defaultSourcePeriodId?: string;
  onSubmit: (options: {
    label: string;
    startDate: string;
    sourcePeriodId?: string;
  }) => Promise<void>;
}) {
  const [startDate, setStartDate] = useState(defaultPlanningStartDate);
  const [label, setLabel] = useState("");
  const [labelTouched, setLabelTouched] = useState(false);
  const [mode, setMode] = useState<"empty" | "duplicate">("empty");
  const [sourcePeriodId, setSourcePeriodId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const archivedOrAll = useMemo(
    () => [...periods].sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [periods]
  );

  useEffect(() => {
    if (!open) return;
    const initialDate = defaultPlanningStartDate();
    setStartDate(initialDate);
    setLabel("");
    setLabelTouched(false);
    setMode(defaultSourcePeriodId ? "duplicate" : "empty");
    setSourcePeriodId(defaultSourcePeriodId ?? periods[0]?.id ?? "");
    setError(null);
    setBusy(false);
  }, [open, defaultSourcePeriodId, periods]);

  useEffect(() => {
    if (!labelTouched) {
      setLabel(periodLabelFromDate(startDate));
    }
  }, [startDate, labelTouched]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      setError("Informe um nome para o planejamento.");
      return;
    }
    if (!startDate) {
      setError("Informe a data de início.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        label: trimmedLabel,
        startDate,
        sourcePeriodId: mode === "duplicate" ? sourcePeriodId : undefined,
      });
      onClose();
    } catch {
      setError("Não foi possível criar o planejamento.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Novo planejamento mensal">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-ag-muted">
          O planejamento ativo atual será arquivado automaticamente. Você pode começar vazio ou
          duplicar um planejamento anterior como base.
        </p>

        <div>
          <FieldLabel>Data de início</FieldLabel>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <div>
          <FieldLabel>Nome do planejamento</FieldLabel>
          <Input
            value={label}
            onChange={(e) => {
              setLabelTouched(true);
              setLabel(e.target.value);
            }}
            placeholder="Ex.: Julho 2026"
          />
        </div>

        <div className="space-y-2">
          <FieldLabel>Conteúdo inicial</FieldLabel>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="period-mode"
                checked={mode === "empty"}
                onChange={() => setMode("empty")}
              />
              Planejamento vazio (30 dias)
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="period-mode"
                checked={mode === "duplicate"}
                onChange={() => setMode("duplicate")}
              />
              Duplicar de planejamento existente
            </label>
          </div>
          {mode === "duplicate" && (
            <select
              value={sourcePeriodId}
              onChange={(e) => setSourcePeriodId(e.target.value)}
              className="mt-2 w-full rounded-lg border border-ag-border bg-ag-surface px-3 py-2 text-sm"
            >
              {archivedOrAll.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} ({p.startDate})
                </option>
              ))}
            </select>
          )}
        </div>

        {error && (
          <p className="text-xs text-ag-danger rounded-lg border border-ag-danger/30 bg-ag-danger/10 px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Criando…" : "Criar planejamento"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
