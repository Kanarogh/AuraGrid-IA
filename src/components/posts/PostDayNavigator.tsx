import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../ui/Button";

export function PostDayNavigator({
  position,
  total,
  dayNumber,
  dateLabel,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
}: {
  position: number;
  total: number;
  dayNumber: number;
  dateLabel: string;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-2.5 rounded-lg border border-ag-border bg-ag-surface-2/60">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={onPrevious}
        disabled={!hasPrevious}
        className="sm:min-w-[120px] justify-center"
      >
        <ChevronLeft className="h-4 w-4" />
        Anterior
      </Button>

      <div className="text-center min-w-0 px-2 order-first sm:order-none">
        <p className="text-[10px] font-mono uppercase tracking-widest text-ag-muted">
          {position} de {total}
          {total === 1 ? " post" : " posts"}
        </p>
        <p className="text-sm font-semibold text-ag-text truncate">
          Dia {dayNumber} — {dateLabel}
        </p>
      </div>

      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={onNext}
        disabled={!hasNext}
        className="sm:min-w-[120px] justify-center"
      >
        Próximo
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
