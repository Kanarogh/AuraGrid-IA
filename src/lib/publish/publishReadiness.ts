import type { PlannedPost } from "../../types";

export type PublishReadinessIssue = "foto" | "legenda" | "aprovação";

export function publishReadinessIssuesCore(input: {
  isConfirmed?: boolean;
  imageAssetId?: string | null;
  caption?: string | null;
}): PublishReadinessIssue[] {
  const missing: PublishReadinessIssue[] = [];
  if (!input.isConfirmed) missing.push("aprovação");
  if (!input.imageAssetId) missing.push("foto");
  if (!input.caption?.trim()) missing.push("legenda");
  return missing;
}

export function isPublishReadyCore(input: {
  isConfirmed?: boolean;
  imageAssetId?: string | null;
  caption?: string | null;
}): boolean {
  return publishReadinessIssuesCore(input).length === 0;
}

export function isPublishReadyPost(post: PlannedPost): boolean {
  return isPublishReadyCore({
    isConfirmed: post.isConfirmed,
    imageAssetId: post.imageAssetId,
    caption: post.caption,
  });
}

export function publishReadinessIssuesFromPost(post: PlannedPost): PublishReadinessIssue[] {
  return publishReadinessIssuesCore({
    isConfirmed: post.isConfirmed,
    imageAssetId: post.imageAssetId,
    caption: post.caption,
  });
}

/** Whether the user may toggle approval on — cloud mode requires persisted asset. */
export function canApproveForPublish(post: PlannedPost, cloudMode: boolean): boolean {
  if (!post.caption?.trim()) return false;
  if (cloudMode) return !!post.imageAssetId;
  return !!(post.imageAssetId || post.image);
}

export function publishReadinessIssueLabel(issue: PublishReadinessIssue): string {
  if (issue === "foto") return "falta foto";
  if (issue === "legenda") return "falta legenda";
  return "falta aprovação";
}

export function summarizeReadinessIssues(
  items: Array<{ isConfirmed: boolean; imageAssetId: string | null; caption: string }>
): { missingPhoto: number; missingCaption: number; missingApproval: number } {
  let missingPhoto = 0;
  let missingCaption = 0;
  let missingApproval = 0;
  for (const item of items) {
    const issues = publishReadinessIssuesCore(item);
    if (issues.includes("foto")) missingPhoto++;
    if (issues.includes("legenda")) missingCaption++;
    if (issues.includes("aprovação")) missingApproval++;
  }
  return { missingPhoto, missingCaption, missingApproval };
}
