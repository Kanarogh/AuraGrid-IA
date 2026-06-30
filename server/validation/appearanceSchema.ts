import { z } from "zod";

export const ACCENT_IDS = [
  "aura",
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

export const appearanceAccentSchema = z
  .object({
    accentId: z.enum(ACCENT_IDS),
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

export type AppearanceAccentPayload = z.infer<typeof appearanceAccentSchema>;

/** Resposta GET inclui theme legado; PUT de cor não altera o tema. */
export const appearanceSettingsSchema = appearanceAccentSchema;

export type AppearanceSettingsPayload = AppearanceAccentPayload;

export function parseAppearanceSettingsBody(body: unknown): AppearanceAccentPayload {
  return appearanceAccentSchema.parse(body);
}
