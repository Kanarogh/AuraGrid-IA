import type { ContentScheduleItem, ContentScheduleSection } from "../../types";

export type RawScheduleItem = {
  name?: string;
  section?: string;
  postType?: string;
  headline?: string;
  subtitle?: string;
  cta?: string;
  legenda?: string;
  hashtags?: string;
  suggestedDate?: string;
  imagePrompt?: string;
  storyExtras?: {
    pollOptions?: string[];
    onScreenText?: string;
  };
};

const STORY_LEGENDA_MAX_WORDS = 45;

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function truncateWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text.trim();
  return words.slice(0, maxWords).join(" ");
}

export function createScheduleItemId(section: ContentScheduleSection, order: number): string {
  return `schedule_${section}_${order}_${Date.now()}`;
}

export function normalizeRawScheduleItem(
  item: RawScheduleItem,
  section: ContentScheduleSection,
  order: number,
  options?: { preserveId?: string; preserveStatus?: ContentScheduleItem["status"]; linkedPostId?: string }
): ContentScheduleItem {
  const poll =
    item.storyExtras?.pollOptions?.length === 2
      ? ([item.storyExtras.pollOptions[0], item.storyExtras.pollOptions[1]] as [string, string])
      : undefined;

  let legenda = item.legenda?.trim() ?? "";
  let hashtags = item.hashtags?.trim() ?? "";

  if (section === "stories") {
    hashtags = "";
    if (wordCount(legenda) > STORY_LEGENDA_MAX_WORDS) {
      legenda = truncateWords(legenda, STORY_LEGENDA_MAX_WORDS);
    }
  }

  return {
    id: options?.preserveId ?? createScheduleItemId(section, order),
    order,
    section,
    name: item.name?.trim() || (section === "posts" ? `POST ${order}` : `STORY ${order}`),
    postType: item.postType?.trim() || (section === "posts" ? "Arte Única" : "Story"),
    scheduledDate: item.suggestedDate?.trim() || undefined,
    status: options?.preserveStatus ?? "draft",
    headline: item.headline?.trim() ?? "",
    subtitle: item.subtitle?.trim() ?? "",
    cta: item.cta?.trim() ?? "",
    legenda,
    hashtags,
    imagePrompt: item.imagePrompt?.trim() || undefined,
    storyExtras:
      poll || item.storyExtras?.onScreenText
        ? {
            pollOptions: poll,
            onScreenText: item.storyExtras?.onScreenText?.trim(),
          }
        : undefined,
    linkedPostId: options?.linkedPostId,
  };
}

export function normalizeRawScheduleItems(raw: RawScheduleItem[]): ContentScheduleItem[] {
  return raw.map((item, index) => {
    const section = item.section === "stories" ? "stories" : "posts";
    return normalizeRawScheduleItem(item, section, index + 1);
  });
}
