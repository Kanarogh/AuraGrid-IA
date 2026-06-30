"use client";

import type { CanvaGridPage, PlannedPost } from "../../types";
import { PublishSchedulerHub } from "./PublishSchedulerHub";

export function PostSchedulingWorkspace({
  clientId,
  planningPeriodId,
  startDate,
  instagramHandle,
  displayName,
  posts,
  canvaPages,
  canvaGridReversed,
  onNavigatePosts,
  onNavigateToPost,
  metaConnectedParam,
  linkedinConnectedParam,
  pinterestConnectedParam,
}: {
  clientId: string;
  planningPeriodId: string;
  startDate: string;
  instagramHandle: string;
  displayName: string;
  posts: PlannedPost[];
  canvaPages?: CanvaGridPage[];
  canvaGridReversed?: boolean;
  onNavigatePosts: () => void;
  onNavigateToPost: (plannedPostId: string) => void;
  metaConnectedParam?: boolean;
  linkedinConnectedParam?: boolean;
  pinterestConnectedParam?: boolean;
}) {
  return (
    <PublishSchedulerHub
      clientId={clientId}
      planningPeriodId={planningPeriodId}
      startDate={startDate}
      instagramHandle={instagramHandle}
      displayName={displayName}
      posts={posts}
      canvaPages={canvaPages}
      canvaGridReversed={canvaGridReversed}
      onNavigatePosts={onNavigatePosts}
      onNavigateToPost={onNavigateToPost}
      metaConnectedParam={metaConnectedParam}
      linkedinConnectedParam={linkedinConnectedParam}
      pinterestConnectedParam={pinterestConnectedParam}
    />
  );
}
