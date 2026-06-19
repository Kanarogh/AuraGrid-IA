import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Building,
  Check,
  ChevronDown,
  Hash,
  Info,
  ListOrdered,
  PhoneCall,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Type,
  CalendarDays,
  Palette,
} from "lucide-react";
import { cn } from "../../lib/cn";
import { toast } from "../../lib/toast";
import { gemInitial } from "../../lib/brandGem";
import { brandGemSignature } from "../../lib/brandGemSignature";
import {
  CAPTION_FIELD_ANCHOR_LABELS,
  createCaptionCustomField,
  type CaptionCustomField,
  type CaptionFieldAnchor,
} from "../../lib/captionFields";
import {
  CAPTION_EMOJI_POLICY_LABELS,
  CAPTION_HOOK_STYLE_LABELS,
  CAPTION_SALES_TONE_LABELS,
  DEFAULT_CAPTION_GENERATION_PARAMS,
  normalizeCaptionGenerationParams,
  type CaptionGenerationParams,
} from "../../lib/captionParams";
import {
  brandGemFieldLabel,
  getMissingBrandGemFields,
  isBrandGemReadyForCaptions,
} from "../../lib/brandGemValidation";
import type { BrandGem } from "../../types";
import { AiProviderPanel } from "./AiProviderPanel";
import { AccentPicker } from "./AccentPicker";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { FieldLabel, Input, Textarea } from "../ui/Input";
import { useAuth } from "../../context/AuthContext";
import { migrateLocalStorageApi } from "../../lib/api/workspaceApi";
import { REGISTRY_KEY } from "../../lib/clientWorkspace/types";

function formatSavedAt(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

export function ConfigPanel({
  open = true,
  variant = "panel",
  clientName,
  brandGem,
  brandGemSavedAt,
  onSaveBrandGem,
}: {
  open?: boolean;
  variant?: "panel" | "page";
  onClose?: () => void;
  clientName: string;
  brandGem: BrandGem;
  brandGemSavedAt?: string | null;
  onSaveBrandGem: (gem: BrandGem) => Promise<string | null>;
}) {
  const { storageMode } = useAuth();
  const [footerOpen, setFooterOpen] = useState(true);
  const [captionParamsOpen, setCaptionParamsOpen] = useState(true);
  const [draftGem, setDraftGem] = useState<BrandGem>(brandGem);
  const [justSaved, setJustSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraftGem(brandGem);
    setJustSaved(false);
  }, [brandGem]);

  const isDirty = brandGemSignature(draftGem) !== brandGemSignature(brandGem);
  const savedLabel = useMemo(() => formatSavedAt(brandGemSavedAt), [brandGemSavedAt]);
  const missingFields = getMissingBrandGemFields(draftGem);
  const gemReady = isBrandGemReadyForCaptions(draftGem);

  if (!open) return null;

  const isPage = variant === "page";

  const isMissing = (key: Parameters<typeof brandGemFieldLabel>[0]) =>
    missingFields.includes(key);

  const requiredMark = (key: Parameters<typeof brandGemFieldLabel>[0]) =>
    isMissing(key) ? (
      <span className="text-ag-danger ml-1" title="Obrigatório para gerar legendas">
        *
      </span>
    ) : null;

  const patch = (partial: Partial<BrandGem>) => {
    setDraftGem((prev) => ({ ...prev, ...partial }));
    setJustSaved(false);
  };

  const patchFooter = (partial: Partial<BrandGem["footer"]>) => {
    setDraftGem((prev) => ({
      ...prev,
      footer: { ...prev.footer, ...partial },
    }));
    setJustSaved(false);
  };

  const customFields = draftGem.footer.customFields ?? [];

  const patchCustomField = (id: string, patch: Partial<CaptionCustomField>) => {
    patchFooter({
      customFields: customFields.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    });
  };

  const addCustomField = () => {
    patchFooter({
      customFields: [...customFields, createCaptionCustomField()],
    });
  };

  const removeCustomField = (id: string) => {
    patchFooter({
      customFields: customFields.filter((f) => f.id !== id),
    });
  };

  const captionParams = normalizeCaptionGenerationParams(draftGem.captionParams);

  const patchCaptionParams = (partial: Partial<CaptionGenerationParams>) => {
    patch({
      captionParams: normalizeCaptionGenerationParams({
        ...captionParams,
        ...partial,
      }),
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const savedAt = await onSaveBrandGem(draftGem);
      if (savedAt) {
        setJustSaved(true);
        window.setTimeout(() => setJustSaved(false), 2500);
      }
    } finally {
      setSaving(false);
    }
  };

  const saveBar = (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-4",
        isDirty
          ? "border-ag-warning/30 bg-ag-warning/5"
          : justSaved
            ? "border-ag-success/30 bg-ag-success/5"
            : "border-ag-border bg-ag-surface-2/60"
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-ag-text">
          Cliente: <span className="text-ag-accent">{clientName}</span>
        </p>
        <p className="text-[11px] text-ag-muted mt-0.5 font-mono truncate">
          {storageMode === "postgresql"
            ? `PostgreSQL + mídia na nuvem → cliente ${brandGem.id}`
            : `localStorage (dev) → auragrid_ws:${brandGem.id}`}
        </p>
        <p className="text-xs mt-1.5">
          {isDirty ? (
            <span className="text-ag-warning font-medium">Alterações não salvas</span>
          ) : justSaved ? (
            <span className="text-ag-success font-medium inline-flex items-center gap-1">
              <Check className="h-3.5 w-3.5" />
              {storageMode === "postgresql" ? "Gem salvo na nuvem" : "Gem salvo neste dispositivo"}
            </span>
          ) : savedLabel ? (
            <span className="text-ag-muted">
              Último salvamento: <strong className="text-ag-text">{savedLabel}</strong>
            </span>
          ) : (
            <span className="text-ag-muted">
              Preencha os campos e clique em Salvar — cada cliente guarda o seu Gem separado.
            </span>
          )}
        </p>
      </div>
      <Button
        type="button"
        variant="accent"
        size="md"
        onClick={() => void handleSave()}
        disabled={!isDirty || saving}
        className="shrink-0 w-full sm:w-auto"
      >
        {saving ? (
          <>
            <Save className="h-4 w-4 animate-pulse" />
            Salvando…
          </>
        ) : justSaved ? (
          <>
            <Check className="h-4 w-4" />
            Salvo
          </>
        ) : (
          <>
            <Save className="h-4 w-4" />
            Salvar Gem
          </>
        )}
      </Button>
    </div>
  );

  const content = (
    <>
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="h-5 w-5 text-ag-accent" />
        <h2
          className={cn(
            "font-semibold text-ag-text",
            isPage ? "font-display text-2xl" : "font-display text-xl"
          )}
        >
          Gem da marca
        </h2>
      </div>
      <p className="text-sm text-ag-muted mb-4">
        Configure tom, instruções e rodapé fixo para{" "}
        <strong className="text-ag-text">{clientName}</strong> (
        <code className="text-xs font-mono text-ag-accent">{brandGem.id}</code>). As legendas só
        usam estes dados depois de clicar em <strong className="text-ag-text">Salvar Gem</strong>.
      </p>

      <div className="mb-6">{saveBar}</div>

      {!gemReady && (
        <div className="mb-6 flex gap-2 text-xs text-ag-warning bg-ag-warning/10 border border-ag-warning/25 rounded-xl p-3">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            <strong>Gem incompleto:</strong> preencha todos os campos obrigatórios antes de gerar
            legendas. Pendentes:{" "}
            {missingFields.map((key) => brandGemFieldLabel(key)).join(", ")}.
          </p>
        </div>
      )}

      {gemReady && !isDirty && (
        <div className="mb-6 flex gap-2 text-xs text-ag-success bg-ag-success/10 border border-ag-success/25 rounded-xl p-3">
          <Sparkles className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            <strong>Gem pronto.</strong> Tom, idioma e rodapé serão aplicados em cada legenda gerada
            ou refinada.
          </p>
        </div>
      )}

      <div className="mb-8 rounded-2xl border border-ag-border bg-ag-surface-2/50 p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-ag-accent" />
          <h3 className="font-display text-lg font-semibold text-ag-text tracking-tight">
            Aparência
          </h3>
        </div>
        <p className="text-sm text-ag-muted leading-relaxed">
          Escolha a cor de destaque do workspace. Neutros e modo claro/escuro continuam na barra
          superior.
        </p>
        <AccentPicker />
      </div>

      <div className="mb-8">
        <AiProviderPanel />
      </div>

      <div className="rounded-2xl border border-ag-border bg-ag-surface-2/50 p-5 sm:p-6 space-y-5">
        <div className="flex items-center gap-4 pb-4 border-b border-ag-border/60">
          <div
            className="h-14 w-14 rounded-full bg-gradient-to-br from-ag-accent to-ag-accent-strong flex items-center justify-center text-2xl font-display font-semibold text-ag-accent-fg shadow-md shrink-0"
            aria-hidden
          >
            {gemInitial(draftGem.name)}
          </div>
          <div className="min-w-0 flex-1">
            <FieldLabel>Nome{requiredMark("name")}</FieldLabel>
            <Input
              value={draftGem.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="Nome da marca ou do Gem"
              className="text-base font-medium"
            />
          </div>
        </div>

        <div>
          <FieldLabel>Descrição{requiredMark("description")}</FieldLabel>
          <Textarea
            value={draftGem.description}
            onChange={(e) => patch({ description: e.target.value })}
            rows={3}
            placeholder="Ex.: papel do assistente, público, idioma das legendas…"
            className="text-sm"
          />
        </div>

        <div>
          <FieldLabel>
            <span className="inline-flex items-center gap-1.5">
              Instruções{requiredMark("instructions")}
              <span
                className="text-ag-muted cursor-help"
                title="Regras completas de tom, idioma, público e estilo — equivalente ao campo Instruções do Gem no Gemini."
              >
                ⓘ
              </span>
            </span>
          </FieldLabel>
          <Textarea
            value={draftGem.instructions}
            onChange={(e) => patch({ instructions: e.target.value })}
            rows={14}
            placeholder="Tom, idioma, regras de venda, estilo Instagram…"
            className="text-sm leading-relaxed font-mono"
          />
          <p className="text-[11px] text-ag-muted mt-1.5">
            Enviado à IA em cada legenda (individual, lote ou refinamento) após salvar.
          </p>
        </div>

        <div className="rounded-xl border border-ag-warning/25 bg-ag-warning/5 p-4">
          <FieldLabel>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-ag-warning" />
              Briefing da coleção / campanha
              <span
                className="text-ag-muted cursor-help"
                title="Contexto do planejamento atual: tema do mês, manifesto da coleção, restrições legais, ganchos emocionais. Atualize a cada nova coleção."
              >
                ⓘ
              </span>
            </span>
          </FieldLabel>
          <Textarea
            value={draftGem.campaignContext ?? ""}
            onChange={(e) => patch({ campaignContext: e.target.value })}
            rows={12}
            placeholder="Ex.: mês de junho/2026, tema Copa, manifesto da Coleção Encanto Brasileiro, variações de nome, ganchos de desejo…"
            className="text-sm leading-relaxed mt-1.5"
          />
          <p className="text-[11px] text-ag-muted mt-1.5 leading-relaxed">
            Complemento que <strong className="text-ag-text font-medium">muda a cada planejamento</strong> — não
            misture com as instruções gerais da marca. A IA usa este texto para nomes de coleção, ângulos sazonais e
            legendas do mês atual.
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-ag-border bg-ag-surface-1/80 overflow-hidden">
        <button
          type="button"
          onClick={() => setCaptionParamsOpen((o) => !o)}
          className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold text-ag-text hover:bg-ag-surface-2 cursor-pointer"
        >
          <span className="inline-flex items-center gap-2">
            <Type className="h-4 w-4 text-ag-accent" />
            Parâmetros de geração da legenda
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-ag-muted transition-transform",
              captionParamsOpen && "rotate-180"
            )}
          />
        </button>
        {captionParamsOpen && (
          <div className="px-4 pb-4 pt-0 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-ag-border/60">
            <div className="sm:col-span-2">
              <p className="text-xs text-ag-muted py-2 leading-relaxed">
                Defina quantos caracteres o <strong className="text-ag-text">texto principal</strong>{" "}
                pode ter. Referência, nota de IA, endereço, CTA, hashtags e campos extras{" "}
                <strong className="text-ag-text">não contam</strong> nesse limite.
              </p>
            </div>
            <div className="sm:col-span-2">
              <FieldLabel>Caracteres da legenda (texto principal)</FieldLabel>
              <Input
                type="number"
                min={80}
                max={1500}
                value={captionParams.maxHookChars}
                onChange={(e) =>
                  patchCaptionParams({ maxHookChars: Number(e.target.value) })
                }
              />
              <p className="text-[10px] text-ag-muted mt-1 leading-relaxed">
                Conta só o gancho/marketing. <strong>Não entram:</strong> Referência, nota de IA,
                endereço, CTA, hashtags e campos extras. O Instagram limita a legenda completa a{" "}
                {2200} caracteres.
              </p>
            </div>
            <div>
              <FieldLabel>Máx. frases no texto principal</FieldLabel>
              <Input
                type="number"
                min={1}
                max={4}
                value={captionParams.maxHookSentences}
                onChange={(e) =>
                  patchCaptionParams({ maxHookSentences: Number(e.target.value) })
                }
              />
            </div>
            <div>
              <FieldLabel>Estilo do gancho</FieldLabel>
              <select
                value={captionParams.hookStyle}
                onChange={(e) =>
                  patchCaptionParams({
                    hookStyle: e.target.value as CaptionGenerationParams["hookStyle"],
                  })
                }
                className="h-10 w-full rounded-lg border border-ag-border bg-ag-surface-1 px-3 text-sm text-ag-text"
              >
                {(
                  Object.entries(CAPTION_HOOK_STYLE_LABELS) as [
                    CaptionGenerationParams["hookStyle"],
                    string,
                  ][]
                ).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel>Tom comercial</FieldLabel>
              <select
                value={captionParams.salesTone}
                onChange={(e) =>
                  patchCaptionParams({
                    salesTone: e.target.value as CaptionGenerationParams["salesTone"],
                  })
                }
                className="h-10 w-full rounded-lg border border-ag-border bg-ag-surface-1 px-3 text-sm text-ag-text"
              >
                {(
                  Object.entries(CAPTION_SALES_TONE_LABELS) as [
                    CaptionGenerationParams["salesTone"],
                    string,
                  ][]
                ).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel>Emojis no gancho</FieldLabel>
              <select
                value={captionParams.emojiPolicy}
                onChange={(e) =>
                  patchCaptionParams({
                    emojiPolicy: e.target.value as CaptionGenerationParams["emojiPolicy"],
                  })
                }
                className="h-10 w-full rounded-lg border border-ag-border bg-ag-surface-1 px-3 text-sm text-ag-text"
              >
                {(
                  Object.entries(CAPTION_EMOJI_POLICY_LABELS) as [
                    CaptionGenerationParams["emojiPolicy"],
                    string,
                  ][]
                ).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 flex flex-col gap-2 pt-1">
              <label className="flex items-center gap-2 text-sm text-ag-text cursor-pointer">
                <input
                  type="checkbox"
                  checked={captionParams.includeReferenceWhenMatched}
                  onChange={(e) =>
                    patchCaptionParams({ includeReferenceWhenMatched: e.target.checked })
                  }
                  className="rounded border-ag-border"
                />
                Incluir linha Referência quando houver match no catálogo
              </label>
              <label className="flex items-center gap-2 text-sm text-ag-text cursor-pointer">
                <input
                  type="checkbox"
                  checked={captionParams.avoidPriceMention}
                  onChange={(e) =>
                    patchCaptionParams({ avoidPriceMention: e.target.checked })
                  }
                  className="rounded border-ag-border"
                />
                Evitar menção a preços e descontos no gancho
              </label>
            </div>
            <div className="sm:col-span-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => patch({ captionParams: { ...DEFAULT_CAPTION_GENERATION_PARAMS } })}
              >
                Restaurar padrões de geração
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-ag-border bg-ag-surface-1/80 overflow-hidden">
        <button
          type="button"
          onClick={() => setFooterOpen((o) => !o)}
          className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold text-ag-text hover:bg-ag-surface-2 cursor-pointer"
        >
          <span>Dados fixos nas legendas (obrigatórios para gerar)</span>
          <ChevronDown
            className={cn("h-4 w-4 text-ag-muted transition-transform", footerOpen && "rotate-180")}
          />
        </button>
        {footerOpen && (
          <div className="px-4 pb-4 pt-0 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-ag-border/60">
            <div className="sm:col-span-2">
              <p className="text-xs text-ag-muted py-2 leading-relaxed">
                Ordem padrão: <strong className="text-ag-text">gancho</strong> →{" "}
                <strong className="text-ag-text">Referência</strong> (se houver match) →{" "}
                <strong className="text-ag-text">nota IA</strong> → endereço → CTA → hashtags.
                Use <strong className="text-ag-text">campos extras</strong> para blocos fixos
                adicionais (promo, horário, link, etc.).
              </p>
            </div>
            <div className="sm:col-span-2">
              <FieldLabel>
                <span className="inline-flex items-center gap-1">
                  <ListOrdered className="h-3 w-3" /> Estrutura da legenda (opcional)
                </span>
              </FieldLabel>
              <Textarea
                value={draftGem.footer.structure ?? ""}
                onChange={(e) => patchFooter({ structure: e.target.value })}
                rows={4}
                placeholder="Notas extras sobre a ordem dos blocos, se precisar…"
                className="text-sm"
              />
            </div>
            <div>
              <FieldLabel>
                <span className="inline-flex items-center gap-1">
                  <Building className="h-3 w-3" /> Endereço{requiredMark("footer.address")}
                </span>
              </FieldLabel>
              <Input
                value={draftGem.footer.address}
                onChange={(e) => patchFooter({ address: e.target.value })}
                placeholder="Endereço da loja (se quiser no rodapé da legenda)"
              />
            </div>
            <div>
              <FieldLabel>
                <span className="inline-flex items-center gap-1">
                  <PhoneCall className="h-3 w-3" /> Contato{requiredMark("footer.contact")}
                </span>
              </FieldLabel>
              <Input
                value={draftGem.footer.contact}
                onChange={(e) => patchFooter({ contact: e.target.value })}
                placeholder="Acesse nosso site pelo link na Bio… (➡️ é adicionado automaticamente)"
              />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel>
                <span className="inline-flex items-center gap-1">
                  <Hash className="h-3 w-3" /> Hashtags{requiredMark("footer.hashtags")}
                </span>
              </FieldLabel>
              <Input
                value={draftGem.footer.hashtags}
                onChange={(e) => patchFooter({ hashtags: e.target.value })}
                placeholder="#Marca #Coleção …"
              />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel>
                <span className="inline-flex items-center gap-1">
                  <Info className="h-3 w-3" /> Nota legal / rodapé
                </span>
              </FieldLabel>
              <Input
                value={draftGem.footer.extra}
                onChange={(e) => patchFooter({ extra: e.target.value })}
                placeholder="*Imagem gerada por inteligência artificial"
              />
            </div>

            <div className="sm:col-span-2 pt-2 border-t border-ag-border/60">
              <div className="flex items-center justify-between gap-2 mb-3">
                <FieldLabel>
                  <span className="inline-flex items-center gap-1">
                    <ListOrdered className="h-3 w-3" /> Campos extras da legenda
                  </span>
                </FieldLabel>
                <Button type="button" variant="ghost" size="sm" onClick={addCustomField}>
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar campo
                </Button>
              </div>
              {customFields.length === 0 ? (
                <p className="text-xs text-ag-muted pb-2">
                  Nenhum campo extra. Clique em Adicionar para incluir blocos fixos (ex.: promoção,
                  horário de atendimento, link WhatsApp).
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {customFields.map((field, index) => (
                    <div
                      key={field.id}
                      className="rounded-lg border border-ag-border bg-ag-surface-2/50 p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-ag-muted">
                          Campo {index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeCustomField(field.id)}
                          className="text-ag-muted hover:text-ag-danger p-1 cursor-pointer"
                          title="Remover campo"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Input
                          value={field.label}
                          onChange={(e) =>
                            patchCustomField(field.id, { label: e.target.value })
                          }
                          placeholder="Nome (só para você)"
                        />
                        <select
                          value={field.after}
                          onChange={(e) =>
                            patchCustomField(field.id, {
                              after: e.target.value as CaptionFieldAnchor,
                            })
                          }
                          className="h-10 rounded-lg border border-ag-border bg-ag-surface-1 px-3 text-sm text-ag-text"
                        >
                          {(
                            Object.entries(CAPTION_FIELD_ANCHOR_LABELS) as [
                              CaptionFieldAnchor,
                              string,
                            ][]
                          ).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <Textarea
                        value={field.text}
                        onChange={(e) => patchCustomField(field.id, { text: e.target.value })}
                        rows={2}
                        placeholder="Texto que entra fixo na legenda…"
                        className="text-sm"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6">{saveBar}</div>

      {isPage && (
        <div className="text-xs text-ag-muted pt-6 border-t border-ag-border mt-6 space-y-3">
          <p>
            {storageMode === "postgresql"
              ? "Dados persistidos no PostgreSQL (metadados) e armazenamento de mídia na nuvem."
              : "Modo dev: cada cliente tem workspace próprio no navegador."}
          </p>
          {storageMode === "postgresql" && process.env.NODE_ENV !== "production" && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={async () => {
                try {
                  const rawReg = localStorage.getItem(REGISTRY_KEY);
                  if (!rawReg) {
                    toast.warning("Nenhum dado local encontrado para importar.");
                    return;
                  }
                  const registry = JSON.parse(rawReg);
                  const workspaces: Record<string, unknown> = {};
                  for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (!key?.startsWith("auragrid_ws:")) continue;
                    const id = key.replace("auragrid_ws:", "");
                    const raw = localStorage.getItem(key);
                    if (raw) workspaces[id] = JSON.parse(raw);
                  }
                  await migrateLocalStorageApi({ registry, workspaces });
                  toast.success("Importação concluída! Recarregue a página.");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Falha na importação.");
                }
              }}
            >
              Importar dados do localStorage
            </Button>
          )}
        </div>
      )}
    </>
  );

  if (isPage) {
    return <div className="animate-ag-fade-in">{content}</div>;
  }

  return (
    <Card variant="elevated" className="mb-8 animate-ag-fade-in">
      {content}
    </Card>
  );
}
