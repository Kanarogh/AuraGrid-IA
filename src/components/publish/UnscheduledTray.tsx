"use client";

import { Sparkles } from "lucide-react";
import { Button } from "../ui/Button";
import type { PublishQueueItem } from "../../lib/publish/publishApi";
import { PublishPostCard } from "./PublishPostCard";

export function UnscheduledTray({
  items,
  draftSchedules,
  onItemClick,
  onSuggestAll,
  suggesting,
}: {
  items: PublishQueueItem[];
  draftSchedules: Record<string, string>;
  onItemClick: (item: PublishQueueItem) => void;
  onSuggestAll: () => void;
  suggesting?: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border border-ag-border bg-ag-surface-2/40 p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-ag-muted">Prontos para agendar</p>
          <p className="text-sm font-semibold text-ag-text mt-0.5">
            {items.length} {items.length === 1 ? "post" : "posts"} · arraste para o calendário
          </p>
          <p className="text-[11px] text-ag-muted mt-0.5">
            Apenas posts com legenda, foto e aprovação confirmada.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={suggesting}
          onClick={onSuggestAll}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Preencher automaticamente
        </Button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory">
        {items.map((item) => (
          <div key={item.plannedPostId} className="snap-start shrink-0">
            <PublishPostCard
              item={item}
              draftSchedules={draftSchedules}
              compact
              draggable
              onClick={() => onItemClick(item)}
              showStatus={false}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
