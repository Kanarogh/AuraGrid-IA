import {
  CAPTION_LIMITS,
  PUBLISH_PLATFORMS_V1,
  PLATFORM_LABELS,
  PLATFORM_SHORT_LABELS,
  type PublishPlatform,
} from "./platforms";

export type { PublishPlatform };

export {
  PUBLISH_PLATFORMS_V1,
  PLATFORM_LABELS,
  PLATFORM_SHORT_LABELS,
  CAPTION_LIMITS,
};

export function formatPlatformBadges(platforms: PublishPlatform[]): string {
  return platforms.map((p) => PLATFORM_SHORT_LABELS[p]).join(" · ");
}
