import { ExternalLink } from "lucide-react";
import type { GeminiModelOption } from "../../lib/aiSettings";
import { useAiSettings } from "../../hooks/useAiSettings";
import { FieldLabel } from "../ui/Input";

const GEMINI_DOCS_URL = "https://ai.google.dev/gemini-api/docs/models/gemini";

function renderGeminiOptions(
  models: GeminiModelOption[],
  activeId: string,
  envDefault: string
) {
  const recommended = models.filter((m) => m.recommended);
  const others = models.filter((m) => !m.recommended);
  const custom = !models.some((m) => m.id === activeId);

  return (
    <>
      <option value="__env__">Padrão do .env ({envDefault})</option>
      {recommended.length > 0 && (
        <optgroup label="Recomendados">
          {recommended.map((m) => (
            <option key={m.id} value={m.id}>
              ★ {m.label}
            </option>
          ))}
        </optgroup>
      )}
      {others.length > 0 && (
        <optgroup label="Outros modelos">
          {others.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </optgroup>
      )}
      {custom && <option value={activeId}>{activeId} (custom)</option>}
    </>
  );
}

function selectValue(activeId: string, runtime: string | null) {
  return runtime ? activeId : "__env__";
}

export { geminiModelDisplayLabel } from "../../lib/geminiModelDisplay";

export function GeminiModelPicker({
  variant = "settings",
  disabled = false,
}: {
  variant?: "settings" | "popover";
  disabled?: boolean;
}) {
  const {
    settings,
    saving,
    setGeminiPlanningModel,
    setGeminiIndexingModel,
    setGeminiContentScheduleModel,
    setGeminiReferenceModel,
    resetModelsToEnv,
  } = useAiSettings();
  if (!settings) return null;

  const { gemini } = settings;
  const availableModels = gemini.models.filter((m) => m.vision);
  const indexingModels = gemini.models.filter((m) => m.forCatalog || m.vision);
  const activePlanning = availableModels.find((m) => m.id === gemini.activePlanningModel);
  const activeIndexing = indexingModels.find((m) => m.id === gemini.activeIndexingModel);
  const activeReference = availableModels.find((m) => m.id === gemini.activeReferenceModel);
  const activeSchedule = availableModels.find((m) => m.id === gemini.activeContentScheduleModel);
  const isDisabled = disabled || saving;
  const usesClientOverrides = !!(
    gemini.runtimePlanningModel ||
    gemini.runtimeIndexingModel ||
    gemini.runtimeReferenceModel ||
    gemini.runtimeContentScheduleModel
  );
  const selectClass =
    variant === "popover"
      ? "w-full text-[11px] px-2 py-1.5 rounded-md border border-ag-border bg-ag-surface-2 text-ag-text cursor-pointer"
      : "w-full text-xs px-2 py-1.5 rounded-md border border-ag-border bg-ag-surface-2 text-ag-text";

  const planningSelect = (
    <select
      value={selectValue(gemini.activePlanningModel, gemini.runtimePlanningModel)}
      disabled={isDisabled}
      onChange={(e) => {
        const v = e.target.value;
        void setGeminiPlanningModel(v === "__env__" ? null : v);
      }}
      className={selectClass}
    >
      {renderGeminiOptions(availableModels, gemini.activePlanningModel, gemini.envPlanningModel)}
    </select>
  );

  const indexingSelect = (
    <select
      value={selectValue(gemini.activeIndexingModel, gemini.runtimeIndexingModel)}
      disabled={isDisabled}
      onChange={(e) => {
        const v = e.target.value;
        void setGeminiIndexingModel(v === "__env__" ? null : v);
      }}
      className={selectClass}
    >
      {renderGeminiOptions(indexingModels, gemini.activeIndexingModel, gemini.envIndexingModel)}
    </select>
  );

  const referenceSelect = (
    <select
      value={selectValue(gemini.activeReferenceModel, gemini.runtimeReferenceModel)}
      disabled={isDisabled}
      onChange={(e) => {
        const v = e.target.value;
        void setGeminiReferenceModel(v === "__env__" ? null : v);
      }}
      className={selectClass}
    >
      {renderGeminiOptions(availableModels, gemini.activeReferenceModel, gemini.envReferenceModel)}
    </select>
  );

  const scheduleSelect = (
    <select
      value={selectValue(gemini.activeContentScheduleModel, gemini.runtimeContentScheduleModel)}
      disabled={isDisabled}
      onChange={(e) => {
        const v = e.target.value;
        void setGeminiContentScheduleModel(v === "__env__" ? null : v);
      }}
      className={selectClass}
    >
      {renderGeminiOptions(
        availableModels,
        gemini.activeContentScheduleModel,
        gemini.envContentScheduleModel
      )}
    </select>
  );

  if (variant === "popover") {
    return (
      <div className="border-t border-ag-border/60 pt-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-mono uppercase tracking-widest text-ag-muted">
            Modelos Gemini
          </p>
          <a
            href={GEMINI_DOCS_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 text-[10px] text-ag-muted hover:text-ag-accent"
          >
            Docs
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] text-ag-muted">Planejamento (legendas e refino)</p>
          {planningSelect}
        </div>
        <div className="space-y-1">
          <p className="text-[10px] text-ag-muted">Indexação catálogo</p>
          {indexingSelect}
        </div>
        <div className="space-y-1">
          <p className="text-[10px] text-ag-muted">Busca de referência</p>
          {referenceSelect}
        </div>
        <div className="space-y-1">
          <p className="text-[10px] text-ag-muted">Cronograma de conteúdo</p>
          {scheduleSelect}
        </div>
        <p className="text-[10px] text-ag-muted leading-snug">
          {activePlanning?.description ?? "Modelo do planejamento."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-ag-border bg-ag-surface-1 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <FieldLabel>Modelos Gemini</FieldLabel>
        <div className="flex items-center gap-2">
          {usesClientOverrides && (
            <button
              type="button"
              disabled={isDisabled}
              onClick={() => void resetModelsToEnv()}
              className="text-[10px] font-semibold text-ag-accent hover:underline disabled:opacity-50"
            >
              Usar defaults do .env
            </button>
          )}
          <a
            href={GEMINI_DOCS_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 text-[10px] text-ag-muted hover:text-ag-accent"
          >
            Ver no Google AI
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {usesClientOverrides && (
        <p className="text-[10px] text-ag-muted leading-snug">
          Escolhas salvas neste cliente prevalecem sobre o <code className="text-[9px]">.env</code>.
          Use &quot;Usar defaults do .env&quot; para sincronizar com o servidor.
        </p>
      )}

      <div className="space-y-1.5">
        <p className="text-[10px] font-medium text-ag-text">Planejamento (legendas e refino)</p>
        {planningSelect}
        <p className="text-[10px] text-ag-muted">
          {activePlanning?.description ?? "Modelo customizado ou do .env."}
          {gemini.runtimePlanningModel ? " · Escolha salva no cliente." : " · Usando .env."}
        </p>
      </div>

      <div className="space-y-1.5 border-t border-ag-border pt-2">
        <p className="text-[10px] font-medium text-ag-text">Indexação do catálogo (JSON)</p>
        {indexingSelect}
        <p className="text-[10px] text-ag-muted">
          {activeIndexing?.description ?? "Modelo para enrich-catalog-item."}
          {gemini.runtimeIndexingModel ? " · Escolha salva no cliente." : " · Usando .env."}
        </p>
      </div>

      <div className="space-y-1.5 border-t border-ag-border pt-2">
        <p className="text-[10px] font-medium text-ag-text">Busca de referência</p>
        {referenceSelect}
        <p className="text-[10px] text-ag-muted">
          {activeReference?.description ?? "Modelo para /api/match-reference."}
          {gemini.runtimeReferenceModel ? " · Escolha salva no cliente." : " · Usando .env."}
        </p>
      </div>

      <div className="space-y-1.5 border-t border-ag-border pt-2">
        <p className="text-[10px] font-medium text-ag-text">Cronograma de conteúdo</p>
        {scheduleSelect}
        <p className="text-[10px] text-ag-muted">
          {activeSchedule?.description ?? "Modelo para /api/generate-content-schedule."}
          {gemini.runtimeContentScheduleModel ? " · Escolha salva no cliente." : " · Usando .env."}
        </p>
      </div>
    </div>
  );
}
