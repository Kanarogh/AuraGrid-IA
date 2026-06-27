import { z } from "zod";

export const ACCENT_IDS = [
  "cobalto",
  "esmeralda",
  "argila",
  "rose",
  "vermelho",
  "violeta",
  "grafite",
  "custom",
] as const;

export type AccentIdSchema = (typeof ACCENT_IDS)[number];

const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida (use #RRGGBB).");

export const appearanceSettingsSchema = z
  .object({
    accentId: z.enum(ACCENT_IDS),
    theme: z.enum(["light", "dark"]),
    customAccentLight: hexColorSchema.nullable().optional(),
    customAccentDark: hexColorSchema.nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.accentId !== "custom") return;
    if (!value.customAccentLight) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customAccentLight"],
        message: "Cor clara obrigatória para acento personalizado.",
      });
    }
    if (!value.customAccentDark) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customAccentDark"],
        message: "Cor escura obrigatória para acento personalizado.",
      });
    }
  });

export type AppearanceSettingsPayload = z.infer<typeof appearanceSettingsSchema>;

export function parseAppearanceSettingsBody(body: unknown): AppearanceSettingsPayload {
  return appearanceSettingsSchema.parse(body);
}
