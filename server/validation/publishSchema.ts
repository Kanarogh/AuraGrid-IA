import { z } from "zod";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (ex.: 10:00).");

export const slotTemplatesSchema = z.record(
  z.string().regex(/^[1-5]$/),
  z.array(timeSchema).min(1).max(8)
);

export const publishPrefsSchema = z.object({
  timezone: z.string().min(1).max(64),
  slotTemplates: slotTemplatesSchema,
  defaultLeadMinutes: z.number().int().min(0).max(120),
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
        caption: z.string().max(2200),
        imageAssetId: z.string().uuid(),
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
