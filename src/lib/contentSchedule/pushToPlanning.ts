import { recalculatePostDates } from "../dates";
import type { ContentScheduleItem, PlannedPost } from "../../types";
import { buildCaptionFromScheduleItem } from "./format";

function parseScheduledDate(scheduledDate: string | undefined): Date | null {
  if (!scheduledDate?.trim()) return null;
  const trimmed = scheduledDate.trim();
  const brMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (brMatch) {
    const day = Number(brMatch[1]);
    const month = Number(brMatch[2]);
    let year = brMatch[3] ? Number(brMatch[3]) : new Date().getFullYear();
    if (year < 100) year += 2000;
    return new Date(year, month - 1, day);
  }
  const iso = Date.parse(trimmed);
  if (!Number.isNaN(iso)) return new Date(iso);
  return null;
}

function findPostForDate(posts: PlannedPost[], date: Date): PlannedPost | undefined {
  return posts.find((post) => {
    const label = post.dateLabel.toLowerCase();
    const day = date.getDate();
    const month = date.getMonth() + 1;
    return (
      label.includes(`${day}/${month}`) ||
      label.includes(`${day}/${String(month).padStart(2, "0")}`)
    );
  });
}

function findNextEmptyPost(posts: PlannedPost[], usedIds: Set<string>): PlannedPost | undefined {
  return posts.find((p) => !usedIds.has(p.id) && !p.caption.trim() && !p.image);
}

export type PushToPlanningResult = {
  posts: PlannedPost[];
  items: ContentScheduleItem[];
  pushedCount: number;
  skippedCount: number;
};

/** Envia itens aprovados do cronograma para os dias do planejamento. */
export function pushScheduleToPlanning(
  items: ContentScheduleItem[],
  posts: PlannedPost[],
  startDate: string,
  options?: { onlyApproved?: boolean }
): PushToPlanningResult {
  const onlyApproved = options?.onlyApproved !== false;
  const eligible = items.filter((i) => {
    if (onlyApproved && i.status !== "approved") return false;
    return i.section === "posts";
  });
  const datedPosts = recalculatePostDates(startDate, posts);
  const usedPostIds = new Set<string>();
  let pushedCount = 0;
  let skippedCount = 0;

  const nextPosts = [...datedPosts];
  const nextItems = items.map((item) => ({ ...item }));

  for (const item of eligible) {
    const itemIdx = nextItems.findIndex((i) => i.id === item.id);
    if (itemIdx < 0) continue;

    let targetPost: PlannedPost | undefined;
    const parsedDate = parseScheduledDate(item.scheduledDate);
    if (parsedDate) {
      targetPost = findPostForDate(nextPosts, parsedDate);
    }
    if (!targetPost) {
      targetPost = findNextEmptyPost(nextPosts, usedPostIds);
    }
    if (!targetPost) {
      skippedCount += 1;
      continue;
    }

    usedPostIds.add(targetPost.id);
    const postIdx = nextPosts.findIndex((p) => p.id === targetPost!.id);
    if (postIdx < 0) continue;

    const structuredCopy = {
      name: item.name,
      postType: item.postType,
      section: item.section,
      headline: item.headline,
      subtitle: item.subtitle,
      cta: item.cta,
      legenda: item.legenda,
      hashtags: item.hashtags,
      storyExtras: item.storyExtras,
    };

    nextPosts[postIdx] = {
      ...nextPosts[postIdx],
      caption: buildCaptionFromScheduleItem(item),
      structuredCopy,
      captionFromSchedule: true,
      isGenerated: true,
    };

    nextItems[itemIdx] = {
      ...nextItems[itemIdx],
      status: "handed_off",
      linkedPostId: targetPost.id,
    };
    pushedCount += 1;
  }

  return { posts: nextPosts, items: nextItems, pushedCount, skippedCount };
}
