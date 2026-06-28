"use client";

import { CalendarClock } from "lucide-react";
import type { PublishQueueItem } from "../../lib/publish/publishApi";
import { Modal } from "../ui/Modal";
import { PublishPostCard } from "./PublishPostCard";
import { formatDayDetailTitle } from "./publishCalendarUtils";

export function PublishDayDetailModal({
  open,
  dateKey,
  items,
  draftSchedules,
  scheduleTimezone,
  onClose,
  onItemClick,
}: {
  open: boolean;
  dateKey: string | null;
  items: PublishQueueItem[];
  draftSchedules: Record<string, string>;
  scheduleTimezone: string;
  onClose: () => void;
  onItemClick: (item: PublishQueueItem) => void;
}) {
  if (!dateKey) return null;

  const title = formatDayDetailTitle(dateKey);
  const count = items.length;
  const subtitle =
    count === 0
      ? "Nenhuma publicação neste dia"
      : count === 1
        ? "1 publicação agendada"
        : `${count} publicações agendadas`;

  return (
    <Modal open={open} onClose={onClose} title={title} size="lg">
      <div className="space-y-4">
        <p className="text-sm text-ag-muted">
          {subtitle}
          {count > 0 && (
            <span className="text-ag-muted/70"> · {scheduleTimezone.replace("_", " ")}</span>
          )}
        </p>

        {count === 0 ? (
          <div className="rounded-xl border border-dashed border-ag-border bg-ag-surface-2/40 px-4 py-8 text-center space-y-2">
            <CalendarClock className="h-8 w-8 mx-auto text-ag-muted/60" />
            <p className="text-sm text-ag-muted">
              Arraste um post da bandeja <strong className="text-ag-text">Prontos para agendar</strong>{" "}
              para este dia no calendário.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.plannedPostId}>
                <PublishPostCard
                  item={item}
                  dayItems={items}
                  draftSchedules={draftSchedules}
                  variant="row"
                  draggable={false}
                  onClick={() => {
                    onItemClick(item);
                    onClose();
                  }}
                  showStatus
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
