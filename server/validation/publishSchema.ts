import { z } from "zod";
import { PUBLISH_PLATFORMS_V1 } from "../../src/lib/publish/platforms";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (ex.: 10:00).");

export const slotTemplatesSchema = z.record(
  z.string().regex(/^[1-5]$/),
  z.array(timeSchema).min(1).max(8)
);

export const publishPlatformSchema = z.enum(PUBLISH_PLATFORMS_V1);

export const publishPrefsSchema = z.object({
  timezone: z.string().min(1).max(64),
  slotTemplates: slotTemplatesSchema,
  defaultLeadMinutes: z.number().int().min(0).max(120),
  autoScheduleOnDrop: z.boolean().optional(),
  defaultPlatforms: z.array(publishPlatformSchema).min(1).max(4).optional(),
  pinterestDefaultBoardId: z.string().nullable().optional(),
});

export const schedulePreviewSchema = z.object({
  planningPeriodId: z.string().min(1),
  postIds: z.array(z.string().min(1)).optional(),
});

export const createJobsSchema = z.object({
  planningPeriodId: z.string().min(1),
  jobs: z
    .array(
      z.object({
        plannedPostId: z.string().min(1),
        scheduledAt: z.string().datetime({ offset: true }),
        caption: z.string().max(63206),
        imageAssetId: z.string().uuid(),
        platforms: z.array(publishPlatformSchema).min(1).max(4).optional(),
      })
    )
    .min(1)
    .max(100),
});

export const patchJobSchema = z.object({
  scheduledAt: z.string().datetime({ offset: true }).optional(),
  status: z.enum(["cancelled"]).optional(),
});

export type PublishPrefsPayload = z.infer<typeof publishPrefsSchema>;
export type CreateJobsPayload = z.infer<typeof createJobsSchema>;
