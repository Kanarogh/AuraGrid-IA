import type { ReactNode } from "react";
import {
  Copy,
  Loader2,
  MousePointerClick,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import type { ContentScheduleItem } from "../../types";
import { CONTENT_SCHEDULE_STATUS_LABELS } from "../../lib/contentSchedule/format";
import { getScheduleItemQualityHints } from "../../lib/contentSchedule/quality";
import { cn } from "../../lib/cn";
import { WorkspaceCard, WorkspaceCardHeader } from "../layout/WorkspaceCard";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { SCHEDULE_FIELD_CLASS } from "./scheduleUi";

export function ScheduleEditorEmpty({ hasItems }: { hasItems: boolean }) {
  return (
    <WorkspaceCard variant="secondary" className="lg:sticky lg:top-4">
      <div className="flex flex-col items-center text-center py-8 px-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-ag-surface-3 text-ag-muted mb-3">
          <MousePointerClick className="h-5 w-5" aria-hidden />
        </div>
        <p className="text-sm font-medium text-ag-text">
          {hasItems ? "Selecione um item para editar" : "Nenhum item para editar"}
        </p>
        <p className="text-xs text-ag-muted mt-1 max-w-[240px] leading-relaxed">
          {hasItems
            ? "Clique em um post ou story na lista ao lado para revisar copy, aprovar ou refinar com IA."
            : "Após gerar o cronograma, os itens aparecerão aqui para revisão."}
        </p>
      </div>
    </WorkspaceCard>
  );
}

type ScheduleEditorPanelProps = {
  item: ContentScheduleItem;
  isReadOnly?: boolean;
  refining: boolean;
  strengthening: boolean;
  refineInstruction: string;
  onRefineInstructionChange: (v: string) => void;
  onClose: () => void;
  onChange: (patch: Partial<ContentScheduleItem>) => void;
  onRefine: () => void;
  onStrengthen: () => void;
  onRegenerate: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onApprove?: () => void;
};

export function ScheduleEditorPanel({
  item,
  isReadOnly,
  refining,
  strengthening,
  refineInstruction,
  onRefineInstructionChange,
  onClose,
  onChange,
  onRefine,
  onStrengthen,
  onRegenerate,
  onDelete,
  onCopy,
  onApprove,
}: ScheduleEditorPanelProps) {
  const isStory = item.section === "stories";
  const qualityHints = getScheduleItemQualityHints(item);
  const legendaLabel = isStory ? "Texto de apoio" : "Legenda";
  const imagePromptPlaceholder = isStory
    ? "Frame 9:16, texto na tela, safe zones..."
    : "Composição 4:5, hierarquia de texto na arte...";
  const busy = refining || strengthening;

  return (
    <WorkspaceCard
      variant="primary"
      className="relative lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 p-1 rounded-lg text-ag-muted hover:text-ag-text hover:bg-ag-surface-3 z-10"
        aria-label="Fechar editor"
      >
        <X className="h-4 w-4" />
      </button>

      <WorkspaceCardHeader
        title={item.name}
        subtitle={`${item.postType} · ${CONTENT_SCHEDULE_STATUS_LABELS[item.status]}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {!isReadOnly && item.status === "draft" && onApprove && (
              <Button type="button" variant="accent" size="sm" onClick={onApprove}>
                Aprovar
              </Button>
            )}
            <Button type="button" variant="secondary" size="sm" onClick={onCopy}>
              <Copy className="h-4 w-4" />
              Copiar
            </Button>
            {!isReadOnly && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="text-ag-danger border-ag-danger/25 hover:bg-ag-danger/10"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        }
      />

      {qualityHints.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {qualityHints.map((hint) => (
            <Badge key={hint.issue} tone="warning" className="text-[10px]">
              {hint.label}
            </Badge>
          ))}
        </div>
      )}

      <EditorSection title="Metadados">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome" className="sm:col-span-2">
            <input
              className={SCHEDULE_FIELD_CLASS}
              value={item.name}
              disabled={isReadOnly}
              onChange={(e) => onChange({ name: e.target.value })}
            />
          </Field>
          <Field label="Formato">
            <input
              className={SCHEDULE_FIELD_CLASS}
              value={item.postType}
              disabled={isReadOnly}
              onChange={(e) => onChange({ postType: e.target.value })}
            />
          </Field>
          <Field label="Data (DD/MM)">
            <input
              className={SCHEDULE_FIELD_CLASS}
              value={item.scheduledDate ?? ""}
              disabled={isReadOnly}
              onChange={(e) => onChange({ scheduledDate: e.target.value })}
            />
          </Field>
        </div>
      </EditorSection>

      <EditorSection title="Conteúdo principal">
        <div className="space-y-3">
          <Field label="Headline">
            <input
              className={SCHEDULE_FIELD_CLASS}
              value={item.headline}
              disabled={isReadOnly}
              onChange={(e) => onChange({ headline: e.target.value })}
            />
          </Field>
          <Field label="Frase de apoio">
            <input
              className={SCHEDULE_FIELD_CLASS}
              value={item.subtitle}
              disabled={isReadOnly}
              onChange={(e) => onChange({ subtitle: e.target.value })}
            />
          </Field>
          <Field label="CTA">
            <input
              className={SCHEDULE_FIELD_CLASS}
              value={item.cta}
              disabled={isReadOnly}
              onChange={(e) => onChange({ cta: e.target.value })}
            />
          </Field>
        </div>
      </EditorSection>

      <EditorSection title={isStory ? "Texto na story" : "Legenda do feed"}>
        <div className="space-y-3">
          <Field label={legendaLabel}>
            <textarea
              className={cn(SCHEDULE_FIELD_CLASS, "min-h-[100px] resize-y")}
              value={item.legenda}
              disabled={isReadOnly}
              onChange={(e) => onChange({ legenda: e.target.value })}
            />
          </Field>
          {!isStory && (
            <Field label="Hashtags">
              <input
                className={SCHEDULE_FIELD_CLASS}
                value={item.hashtags}
                disabled={isReadOnly}
                onChange={(e) => onChange({ hashtags: e.target.value })}
              />
            </Field>
          )}
        </div>
      </EditorSection>

      <EditorSection title="Direção visual">
        <Field label="Prompt de imagem">
          <textarea
            className={cn(SCHEDULE_FIELD_CLASS, "min-h-[80px] resize-y")}
            value={item.imagePrompt ?? ""}
            disabled={isReadOnly}
            placeholder={imagePromptPlaceholder}
            onChange={(e) => onChange({ imagePrompt: e.target.value })}
          />
        </Field>
      </EditorSection>

      {isStory && (
        <EditorSection title="Interações">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Texto na tela" className="sm:col-span-2">
              <input
                className={SCHEDULE_FIELD_CLASS}
                value={item.storyExtras?.onScreenText ?? ""}
                disabled={isReadOnly}
                onChange={(e) =>
                  onChange({
                    storyExtras: { ...item.storyExtras, onScreenText: e.target.value },
                  })
                }
              />
            </Field>
            <Field label="Enquete A">
              <input
                className={SCHEDULE_FIELD_CLASS}
                value={item.storyExtras?.pollOptions?.[0] ?? ""}
                disabled={isReadOnly}
                onChange={(e) =>
                  onChange({
                    storyExtras: {
                      ...item.storyExtras,
                      pollOptions: [e.target.value, item.storyExtras?.pollOptions?.[1] ?? ""],
                    },
                  })
                }
              />
            </Field>
            <Field label="Enquete B">
              <input
                className={SCHEDULE_FIELD_CLASS}
                value={item.storyExtras?.pollOptions?.[1] ?? ""}
                disabled={isReadOnly}
                onChange={(e) =>
                  onChange({
                    storyExtras: {
                      ...item.storyExtras,
                      pollOptions: [item.storyExtras?.pollOptions?.[0] ?? "", e.target.value],
                    },
                  })
                }
              />
            </Field>
          </div>
        </EditorSection>
      )}

      {!isReadOnly && (
        <EditorSection title="Ajustes com IA">
          <div className="space-y-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full justify-center"
              onClick={onStrengthen}
              disabled={busy}
              aria-busy={strengthening}
            >
              {strengthening ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Reforçar copy com IA
            </Button>
            <div className="flex gap-2">
              <input
                type="text"
                value={refineInstruction}
                onChange={(e) => onRefineInstructionChange(e.target.value)}
                placeholder="Refinar: ex. tom mais direto..."
                className={cn(SCHEDULE_FIELD_CLASS, "flex-1")}
                disabled={busy}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onRefine}
                disabled={busy || !refineInstruction.trim()}
                aria-busy={refining}
              >
                {refining ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refinar"}
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={onRegenerate}
              disabled={busy}
            >
              {refining ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              Recriar item com IA
            </Button>
          </div>
        </EditorSection>
      )}
    </WorkspaceCard>
  );
}

function EditorSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-5 last:mb-0">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-ag-muted mb-2.5">
        {title}
      </h4>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block text-xs text-ag-muted", className)}>
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}
