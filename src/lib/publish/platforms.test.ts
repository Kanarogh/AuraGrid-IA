import { describe, expect, it } from "vitest";
import {
  CAPTION_LIMITS,
  maxCaptionLength,
  isPublishPlatform,
  PUBLISH_PLATFORMS_V1,
} from "./platforms";

describe("publish platforms", () => {
  it("recognizes v1 platforms", () => {
    for (const p of PUBLISH_PLATFORMS_V1) {
      expect(isPublishPlatform(p)).toBe(true);
    }
    expect(isPublishPlatform("tiktok")).toBe(false);
  });

  it("uses strictest caption limit across selected platforms", () => {
    expect(maxCaptionLength(["instagram", "pinterest"])).toBe(CAPTION_LIMITS.pinterest);
    expect(maxCaptionLength(["instagram", "facebook"])).toBe(CAPTION_LIMITS.instagram);
  });
});
