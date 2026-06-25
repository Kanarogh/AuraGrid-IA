import type { ClientWorkspace } from "./types";
import { compactCanvaForApiPatch, stripTransientPostFields } from "./persistence";

export function buildWorkspaceApiPatch(ws: ClientWorkspace) {
  if (ws.isReadOnly) return null;
  return {
    brandGem: ws.brandGem,
    startDate: ws.startDate,
    planningPeriodId: ws.activePlanningPeriodId,
    posts: ws.posts.map(stripTransientPostFields),
    contentSchedule: ws.contentSchedule ?? [],
    canva: compactCanvaForApiPatch(ws.canva),
    ui: ws.ui,
  };
}

export function workspaceApiPatchFingerprint(ws: ClientWorkspace): string | null {
  const patch = buildWorkspaceApiPatch(ws);
  return patch ? JSON.stringify(patch) : null;
}
