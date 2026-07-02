import { Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import type { BrandGem } from "../../types";
import type { ContentScheduleSection } from "../../types";
import {
  brandGemRequiredMessage,
  formatMissingBrandGemFields,
} from "../../lib/brandGemValidation";
import { WorkspaceCard, WorkspaceCardHeader } from "../layout/WorkspaceCard";
import { Button } from "../ui/Button";
import { Alert } from "../ui/Alert";

type ScheduleBriefingPanelProps = {
  briefDraft: string;
  onBriefDraftChange: (v: string) => void;
  postCount: number;
  onPostCountChange: (v: number) => void;
  storyCount: number;
  onStoryCountChange: (v: number) => void;
  startDate: string;
  extraInstructions: string;
  onExtraInstructionsChange: (v: string) => void;
  singleItemTheme: string;
  onSingleItemThemeChange: (v: string) => void;
  brandGem: BrandGem;
  brandGemReady: boolean;
  isReadOnly?: boolean;
  generating: boolean;
  creatingSingle: ContentScheduleSection | null;
  hasGeneratedSchedule: boolean;
  missingGemLabels: string[];
  onGenerate: () => void;
  onClearSchedule: () => void;
  onCreateSingle: (section: ContentScheduleSection) => void;
  onConfigureGem?: () => void;
};

export function ScheduleBriefingPanel({
  briefDraft,
  onBriefDraftChange,
  postCount,
  onPostCountChange,
  storyCount,
  onStoryCountChange,
  startDate,
  extraInstructions,
  onExtraInstructionsChange,
  singleItemTheme,
  onSingleItemThemeChange,
  brandGem,
  brandGemReady,
  isReadOnly,
  generating,
  creatingSingle,
  hasGeneratedSchedule,
  missingGemLabels,
  onGenerate,
  onClearSchedule,
  onCreateSingle,
  onConfigureGem,
}: ScheduleBriefingPanelProps) {
  const disabled = isReadOnly || generating;
  const canCreateSingle = !isReadOnly && brandGemReady && !generating && creatingSingle === null;

  return (
    <WorkspaceCard variant="primary">
      <WorkspaceCardHeader
        title="1. Briefing e parâmetros"
        subtitle="Defina o direcionamento do mês. Quanto mais específico (ex.: 3 posts sobre Halloween), melhor a aderência da IA."
      />
      <textarea
        value={briefDraft}
        onChange={(e) => onBriefDraftChange(e.target.value)}
        disabled={disabled}
        rows={5}
        placeholder="Ex.: Quero focar este mês em PDV offline, gestão de estoque e datas sazonais..."
        className="w-full rounded-xl border border-ag-border/70 bg-ag-surface-2/60 px-4 py-3 text-sm text-ag-text placeholder:text-ag-muted focus:outline-none focus:ring-2 focus:ring-ag-accent/40 resize-y min-h-[120px]"
        aria-label="Briefing do mês"
      />
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <label className="block text-xs text-ag-muted">
          Posts de arte
          <input
            type="number"
            min={1}
            max={30}
            value={postCount}
            onChange={(e) => onPostCountChange(Number(e.target.value) || 9)}
            disabled={disabled}
            className="mt-1 w-full rounded-lg border border-ag-border/70 bg-ag-surface-2 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-xs text-ag-muted">
          Stories
          <input
            type="number"
            min={1}
            max={30}
            value={storyCount}
            onChange={(e) => onStoryCountChange(Number(e.target.value) || 12)}
            disabled={disabled}
            className="mt-1 w-full rounded-lg border border-ag-border/70 bg-ag-surface-2 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-xs text-ag-muted">
          Início do mês
          <input
            type="date"
            value={startDate}
            readOnly
            className="mt-1 w-full rounded-lg border border-ag-border/70 bg-ag-surface-3 px-3 py-2 text-sm text-ag-muted"
          />
        </label>
      </div>
      <label className="mt-4 block text-xs text-ag-muted">
        Temas obrigatórios neste mês (opcional)
        <textarea
          value={extraInstructions}
          onChange={(e) => onExtraInstructionsChange(e.target.value)}
          disabled={disabled}
          rows={2}
          placeholder="Ex.: 3 posts sobre estoque, 2 stories de bastidores..."
          className="mt-1 w-full rounded-lg border border-ag-border/70 bg-ag-surface-2 px-3 py-2 text-sm resize-y"
        />
      </label>

      {!brandGemReady && !isReadOnly && (
        <Alert tone="warning" title="Gem da marca incompleto" className="mt-4">
          Configure o Gem para liberar a geração. Campos pendentes:{" "}
          <span className="font-medium text-ag-text">{formatMissingBrandGemFields(brandGem)}</span>
          {onConfigureGem ? (
            <>
              {" "}
              <button
                type="button"
                onClick={onConfigureGem}
                className="font-semibold text-ag-accent hover:underline cursor-pointer"
              >
                Abrir Gem da marca
              </button>
            </>
          ) : null}
        </Alert>
      )}

      <div className="mt-5 pt-4 border-t border-ag-border/50">
        <p className="text-xs font-medium text-ag-text mb-3">2. Gerar cronograma</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="accent"
            onClick={onGenerate}
            disabled={isReadOnly || generating || !brandGemReady}
            title={
              !brandGemReady && missingGemLabels.length > 0
                ? `Preencha no Gem: ${missingGemLabels.join(", ")}`
                : brandGemRequiredMessage(brandGem) || undefined
            }
            aria-busy={generating}
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {hasGeneratedSchedule ? "Regenerar cronograma com IA" : "Gerar cronograma com IA"}
          </Button>
          {hasGeneratedSchedule && !isReadOnly && (
            <Button
              type="button"
              variant="secondary"
              onClick={onClearSchedule}
              disabled={generating}
            >
              <Trash2 className="h-4 w-4" />
              Excluir cronograma
            </Button>
          )}
        </div>
      </div>

      {!isReadOnly && brandGemReady && (
        <div className="mt-5 pt-4 border-t border-ag-border/50 space-y-3">
          <p className="text-xs text-ag-muted">
            Ou monte aos poucos — crie posts e stories avulsos com o briefing acima.
          </p>
          <label className="block text-xs text-ag-muted">
            Tema do próximo item (opcional)
            <input
              type="text"
              value={singleItemTheme}
              onChange={(e) => onSingleItemThemeChange(e.target.value)}
              disabled={!canCreateSingle}
              placeholder="Ex.: Halloween no PDV, dica de estoque..."
              className="mt-1 w-full rounded-lg border border-ag-border/70 bg-ag-surface-2 px-3 py-2 text-sm"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!canCreateSingle}
              onClick={() => onCreateSingle("posts")}
            >
              {creatingSingle === "posts" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Criar 1 post
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!canCreateSingle}
              onClick={() => onCreateSingle("stories")}
            >
              {creatingSingle === "stories" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Criar 1 story
            </Button>
          </div>
        </div>
      )}
    </WorkspaceCard>
  );
}
