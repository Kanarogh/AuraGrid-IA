import { Cpu, RefreshCw } from "lucide-react";
import { useAiSettings } from "../../hooks/useAiSettings";
import { Alert } from "../ui/Alert";
import { Badge } from "../ui/Badge";
import { GeminiModelPicker } from "./GeminiModelPicker";

export function AiProviderPanel() {
  const { settings, loading, saving, error, activeProviderOption, refresh } = useAiSettings();

  return (
    <div className="rounded-xl border border-ag-border bg-ag-surface-2/60 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ag-text flex items-center gap-2">
            <Cpu className="h-4 w-4 text-ag-accent" />
            IA (Gemini)
          </h3>
          <p className="text-xs text-ag-muted mt-0.5">
            Projeto configurado em modo Gemini-only. Ajuste apenas os modelos Gemini usados no
            planejamento, indexação, busca de referência e cronograma por cliente.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading || saving}
          className="p-2 rounded-lg text-ag-muted hover:text-ag-text hover:bg-ag-surface-3 disabled:opacity-50"
          title="Atualizar configuração"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && (
        <Alert tone="danger" title="Configuração de IA">
          {error}
        </Alert>
      )}

      {activeProviderOption && settings && (
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
          <Badge tone={activeProviderOption.configured ? "success" : "danger"} dot>
            {activeProviderOption.configured ? "Chave OK" : "Sem chave"}
          </Badge>
          <span className="text-ag-muted truncate max-w-full">
            Planejamento: {settings.gemini.activePlanningModel}
            {settings.gemini.activeIndexingModel !== settings.gemini.activePlanningModel
              ? ` · Indexação: ${settings.gemini.activeIndexingModel}`
              : ""}
          </span>
        </div>
      )}

      {!loading && settings && <GeminiModelPicker variant="settings" />}
    </div>
  );
}
