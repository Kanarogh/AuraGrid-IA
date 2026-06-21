import type { PlannedPost } from "../types";

export function getPostDayLabel(post: PlannedPost, allPosts: PlannedPost[]): string {
  const dayPosts = allPosts.filter((p) => p.dayNumber === post.dayNumber);
  if (dayPosts.length <= 1) return `Dia ${post.dayNumber}`;
  const slotIndex = dayPosts.findIndex((p) => p.id === post.id);
  return `Dia ${post.dayNumber} · Post ${slotIndex + 1}`;
}

export function countUniqueDays(posts: PlannedPost[]): number {
  return new Set(posts.map((p) => p.dayNumber)).size;
}

export function countPostsWithImage(posts: PlannedPost[]): number {
  return posts.filter((p) => p.image).length;
}
