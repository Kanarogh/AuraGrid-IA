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
  const { settings, saving, setGeminiModel, setGeminiCatalogModel } = useAiSettings();
  if (!settings) return null;

  const { gemini } = settings;
  const mainModels = gemini.models.filter((m) => m.vision);
  const catalogModels = gemini.models.filter((m) => m.forCatalog || m.vision);
  const activeMain = mainModels.find((m) => m.id === gemini.activeModel);
  const activeCatalog = catalogModels.find((m) => m.id === gemini.activeCatalogModel);
  const isDisabled = disabled || saving;
  const selectClass =
    variant === "popover"
      ? "w-full text-[11px] px-2 py-1.5 rounded-md border border-ag-border bg-ag-surface-2 text-ag-text cursor-pointer"
      : "w-full text-xs px-2 py-1.5 rounded-md border border-ag-border bg-ag-surface-2 text-ag-text";

  const mainSelect = (
    <select
      value={selectValue(gemini.activeModel, gemini.runtimeModel)}
      disabled={isDisabled}
      onChange={(e) => {
        const v = e.target.value;
        void setGeminiModel(v === "__env__" ? null : v);
      }}
      className={selectClass}
    >
      {renderGeminiOptions(mainModels, gemini.activeModel, gemini.envModel)}
    </select>
  );

  const catalogSelect = (
    <select
      value={selectValue(gemini.activeCatalogModel, gemini.runtimeCatalogModel)}
      disabled={isDisabled}
      onChange={(e) => {
        const v = e.target.value;
        void setGeminiCatalogModel(v === "__env__" ? null : v);
      }}
      className={selectClass}
    >
      {renderGeminiOptions(catalogModels, gemini.activeCatalogModel, gemini.envCatalogModel)}
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
          <p className="text-[10px] text-ag-muted">Match e legenda</p>
          {mainSelect}
        </div>
        <div className="space-y-1">
          <p className="text-[10px] text-ag-muted">Indexação catálogo</p>
          {catalogSelect}
        </div>
        <p className="text-[10px] text-ag-muted leading-snug">
          {activeMain?.description ?? "Modelo principal."}
          {gemini.activeCatalogModel !== gemini.activeModel && activeCatalog
            ? ` Catálogo: ${activeCatalog.label}.`
            : ""}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-ag-border bg-ag-surface-1 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <FieldLabel>Modelos Gemini</FieldLabel>
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

      <div className="space-y-1.5">
        <p className="text-[10px] font-medium text-ag-text">Match, legenda e refinar</p>
        {mainSelect}
        <p className="text-[10px] text-ag-muted">
          {activeMain?.description ?? "Modelo customizado ou do .env."}
          {gemini.runtimeModel ? " · Escolha salva na plataforma." : " · Usando .env."}
        </p>
      </div>

      <div className="space-y-1.5 border-t border-ag-border pt-2">
        <p className="text-[10px] font-medium text-ag-text">Indexação do catálogo (JSON)</p>
        {catalogSelect}
        <p className="text-[10px] text-ag-muted">
          {activeCatalog?.description ?? "Modelo para enrich-catalog-item."}
          {gemini.runtimeCatalogModel ? " · Escolha salva na plataforma." : " · Usando .env."}
        </p>
      </div>
    </div>
  );
}
