/** Redes com publicação foto+legenda no escopo v1. */
export const PUBLISH_PLATFORMS_V1 = [
  "instagram",
  "facebook",
  "linkedin",
  "pinterest",
] as const;

export type PublishPlatform = (typeof PUBLISH_PLATFORMS_V1)[number];

export const PLATFORM_LABELS: Record<PublishPlatform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  pinterest: "Pinterest",
};

export const PLATFORM_SHORT_LABELS: Record<PublishPlatform, string> = {
  instagram: "IG",
  facebook: "FB",
  linkedin: "IN",
  pinterest: "PIN",
};

/** Limites de legenda por plataforma (v1). */
export const CAPTION_LIMITS: Record<PublishPlatform, number> = {
  instagram: 2200,
  facebook: 63206,
  linkedin: 3000,
  pinterest: 500,
};

export const DEFAULT_PUBLISH_PLATFORMS: PublishPlatform[] = ["instagram"];

export function isPublishPlatform(value: string): value is PublishPlatform {
  return (PUBLISH_PLATFORMS_V1 as readonly string[]).includes(value);
}

export function maxCaptionLength(platforms: PublishPlatform[]): number {
  if (!platforms.length) return CAPTION_LIMITS.instagram;
  return Math.min(...platforms.map((p) => CAPTION_LIMITS[p]));
}

/** Redes que usam conexão Meta (Instagram + Facebook Page). */
export function isMetaPlatform(platform: PublishPlatform): boolean {
  return platform === "instagram" || platform === "facebook";
}
