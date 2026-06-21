import type { CaptionBatchStats } from "../../lib/captionBatch";
import { WorkflowStepper, type WorkflowStep } from "../layout/WorkflowStepper";

export function PostsWorkflowBar({ stats }: { stats: CaptionBatchStats }) {
  const hasPhotos = stats.withImage > 0;
  const hasCalendar = stats.total > 0;
  const hasCaptions = stats.generated > 0 || stats.withImage - stats.pending === stats.withImage;
  const hasApproved = stats.confirmed > 0;

  const steps: WorkflowStep[] = [
    {
      id: "photos",
      label: "Fotos",
      done: hasPhotos,
      active: !hasPhotos && hasCalendar,
    },
    {
      id: "sync",
      label: "Calendário",
      done: hasCalendar && hasPhotos,
      active: hasPhotos && !hasCaptions,
    },
    {
      id: "captions",
      label: "Legendas",
      done: hasCaptions && stats.pending === 0,
      active: hasPhotos && stats.pending > 0,
    },
    {
      id: "approve",
      label: "Aprovar",
      done: hasApproved && stats.confirmed === stats.total && stats.total > 0,
      active: hasCaptions && stats.pending === 0 && !hasApproved,
    },
  ];

  return <WorkflowStepper steps={steps} />;
}
