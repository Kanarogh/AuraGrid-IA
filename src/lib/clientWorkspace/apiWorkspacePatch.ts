import type { ClientWorkspace } from "./types";
import { compactCanvaForApiPatch, compactPostForApiPatch } from "./persistence";

export function buildWorkspaceApiPatch(ws: ClientWorkspace) {
  if (ws.isReadOnly) return null;
  return {
    brandGem: ws.brandGem,
    startDate: ws.startDate,
    planningPeriodId: ws.activePlanningPeriodId,
    posts: ws.posts.map(compactPostForApiPatch),
    contentSchedule: ws.contentSchedule ?? [],
    contentScheduleBrief: ws.contentScheduleBrief ?? "",
    canva: compactCanvaForApiPatch(ws.canva),
    ui: ws.ui,
  };
}

export function workspaceApiPatchFingerprint(ws: ClientWorkspace): string | null {
  const patch = buildWorkspaceApiPatch(ws);
  return patch ? JSON.stringify(patch) : null;
}
