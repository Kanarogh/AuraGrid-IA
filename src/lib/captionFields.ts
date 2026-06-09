/** Onde inserir um campo extra na legenda (blocos fixos). */
export type CaptionFieldAnchor =
  | "after_reference"
  | "after_disclosure"
  | "after_address"
  | "after_contact"
  | "before_hashtags";

export type CaptionCustomField = {
  id: string;
  /** Nome só na UI (Configurações) */
  label: string;
  /** Texto fixo que entra na legenda */
  text: string;
  after: CaptionFieldAnchor;
};

export const CAPTION_FIELD_ANCHOR_LABELS: Record<CaptionFieldAnchor, string> = {
  after_reference: "Após Referência",
  after_disclosure: "Após nota de IA",
  after_address: "Após endereço",
  after_contact: "Após CTA (➡️)",
  before_hashtags: "Antes das hashtags",
};

export function createCaptionCustomField(
  partial?: Partial<CaptionCustomField>
): CaptionCustomField {
  return {
    id: partial?.id ?? `cf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    label: partial?.label ?? "Novo campo",
    text: partial?.text ?? "",
    after: partial?.after ?? "before_hashtags",
  };
}

export function normalizeCaptionCustomFields(
  fields: CaptionCustomField[] | undefined | null
): CaptionCustomField[] {
  if (!Array.isArray(fields)) return [];
  return fields
    .filter((f) => f && typeof f.text === "string")
    .map((f) => ({
      id: f.id?.trim() || createCaptionCustomField().id,
      label: f.label?.trim() || "Campo",
      text: f.text.trim(),
      after: f.after in CAPTION_FIELD_ANCHOR_LABELS ? f.after : "before_hashtags",
    }))
    .filter((f) => f.text.length > 0);
}
