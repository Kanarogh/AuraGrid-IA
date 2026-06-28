import { z } from "zod";
import { normalizeCaptionGenerationParams } from "@/src/lib/captionParams";

export const captionGenerationParamsSchema = z.object({
  maxHookChars: z.number().int().min(80).max(2000),
  maxTotalChars: z.number().int().min(500).max(5000).optional(),
  maxHookSentences: z.number().int().min(1).max(6),
  emojiPolicy: z.enum(["none", "minimal", "moderate", "free"]),
  hookStyle: z.enum(["short", "balanced", "descriptive"]),
  includeReferenceWhenMatched: z.boolean(),
  avoidPriceMention: z.boolean(),
  salesTone: z.enum(["soft", "balanced", "direct"]),
});

export const repeatingTextSchema = z.object({
  structure: z.string().max(4000),
  address: z.string().max(2000),
  contact: z.string().max(2000),
  hashtags: z.string().max(2000),
  extra: z.string().max(4000),
  customFields: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        label: z.string().max(200),
        value: z.string().max(2000),
      })
    )
    .optional(),
});

export const brandGemSaveSchema = z.object({
  id: z.string().min(1).max(120).optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(4000),
  instructions: z.string().max(12000),
  campaignContext: z.string().max(8000).optional(),
  captionParams: captionGenerationParamsSchema.optional(),
  footer: repeatingTextSchema,
});

export type BrandGemSaveInput = z.infer<typeof brandGemSaveSchema>;

export function parseBrandGemSaveBody(body: unknown): BrandGemSaveInput {
  const raw =
    typeof body === "object" && body !== null ? ({ ...(body as Record<string, unknown>) }) : {};
  if (raw.captionParams !== undefined) {
    raw.captionParams = normalizeCaptionGenerationParams(
      raw.captionParams as Parameters<typeof normalizeCaptionGenerationParams>[0]
    );
  }
  return brandGemSaveSchema.parse(raw);
}
