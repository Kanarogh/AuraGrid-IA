import type { ContentScheduleItemStatus } from "../../types";

export const CONTENT_SCHEDULE_STATUS_LABELS: Record<ContentScheduleItemStatus, string> = {
  draft: "Rascunho",
  approved: "Aprovado",
  handed_off: "Entregue",
  done: "Feito",
};
