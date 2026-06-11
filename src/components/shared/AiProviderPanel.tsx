import { useState } from "react";
import { Cpu, ExternalLink, RefreshCw } from "lucide-react";
import {
  providerDisplayName,
  type AiProviderId,
  type OpenRouterModelsFilter,
} from "../../lib/aiSettings";
import { useAiSettings } from "../../hooks/useAiSettings";
import { Alert } from "../ui/Alert";
import { Badge } from "../ui/Badge";
import { FieldLabel } from "../ui/Input";
import { GeminiModelPicker } from "./GeminiModelPicker";
import { OllamaModelPicker } from "./OllamaModelPicker";

export function AiProviderPanel() {
  const {
    settings,
    loading,
    saving,
    error,
    activeProviderOption,
    setProvider,
    refresh,
  } = useAiSettings();

  const handleChange = async (provider: AiProviderId) => {
    if (!settings || provider === settings.activeProvider || saving) return;
    const option = settings.providers.find((p) => p.id === provider);
    if (!option?.configured) return;
    try {
      await setProvider(provider);
    } catch {
      /* erro já no store */
    }
  };

  return (
    <div className="rounded-xl border border-ag-border bg-ag-surface-2/60 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ag-text flex items-center gap-2">
            <Cpu className="h-4 w-4 text-ag-accent" />
            Provedor de IA
          </h3>
          <p className="text-xs text-ag-muted mt-0.5">
            Escolha qual API usar para indexar catálogo e gerar legendas. A escolha fica salva na
            plataforma — <strong className="text-ag-text">só esse provedor/modelo</strong> é usado;
            se falhar, o erro é desse modelo (sem troca automática).
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading || saving}
          className="p-2 rounded-lg text-ag-muted hover:text-ag-text hover:bg-ag-surface-3 disabled:opacity-50"
          title="Atualizar lista"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && (
        <Alert tone="danger" title="Provedor de IA">
          {error}
        </Alert>
      )}

      {loading && !settings ? (
        <p className="text-xs text-ag-muted">Carregando provedores…</p>
      ) : (
        <>
          <div>
            <FieldLabel>Modelo ativo</FieldLabel>
            <select
              value={settings?.activeProvider ?? ""}
              onChange={(e) => void handleChange(e.target.value as AiProviderId)}
              disabled={saving || !settings}
              className="w-full text-sm font-medium rounded-xl px-3 py-2.5 border border-ag-border bg-ag-surface-1 text-ag-text outline-none focus:border-ag-accent"
            >
              {settings?.providers.map((p) => (
                <option key={p.id} value={p.id} disabled={!p.configured}>
                  {p.label}
                  {!p.configured
                    ? p.id === "ollama"
                      ? " (desativado: OLLAMA_DISABLED=1)"
                      : " (sem chave no .env)"
                    : ""}
                </option>
              ))}
            </select>
          </div>

          {activeProviderOption && (
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
              <Badge tone={activeProviderOption.configured ? "success" : "danger"} dot>
                {activeProviderOption.id === "ollama"
                  ? activeProviderOption.configured
                    ? "Local"
                    : "Desativado"
                  : activeProviderOption.configured
                    ? "Chave OK"
                    : "Sem chave"}
              </Badge>
              <span className="text-ag-muted truncate max-w-full">
                Modelo: {activeProviderOption.model}
              </span>
            </div>
          )}

          {settings && settings.activeProvider !== settings.envDefaultProvider && (
            <p className="text-[10px] text-ag-muted">
              Padrão do .env: <strong>{providerDisplayName(settings.envDefaultProvider)}</strong> —
              você está usando outro provedor nesta sessão.
            </p>
          )}

          {settings?.activeProvider === "ollama" && (
            <>
              <OllamaModelPicker variant="settings" />
              <p className="text-[10px] text-ag-muted leading-relaxed">
                Só modelos <strong className="text-ag-text">instalados no disco</strong> aparecem
                acima (sem <code className="font-mono">*:cloud</code>). Mantenha{" "}
                <code className="font-mono">OLLAMA_NUM_CTX=32768</code> no .env. A 1ª foto pode
                demorar 1–3 min enquanto o modelo carrega.
              </p>
            </>
          )}

          {settings?.activeProvider === "openrouter" && (
            <OpenRouterModelSelect />
          )}

          {settings?.activeProvider === "gemini" && (
            <GeminiModelPicker variant="settings" />
          )}

          <ul className="text-[10px] text-ag-muted space-y-1 border-t border-ag-border pt-2">
            {settings?.providers.map((p) => (
              <li key={p.id} className="flex justify-between gap-2">
                <span>{p.label}</span>
                <span className={p.configured ? "text-ag-success" : "text-ag-danger"}>
                  {p.configured ? "disponível" : "configure .env"}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

const OPENROUTER_FILTER_URLS: Record<OpenRouterModelsFilter, string> = {
  "vision-text":
    "https://openrouter.ai/models?output_modalities=text&input_modalities=image",
  "vision-image":
    "https://openrouter.ai/models?output_modalities=image&input_modalities=image",
  "vision-any": "https://openrouter.ai/models?input_modalities=image",
};

function OpenRouterModelSelect() {
  const { settings, saving, setOpenRouterModel, refreshOpenRouterModels } = useAiSettings();
  const [filter, setFilter] = useState<OpenRouterModelsFilter>("vision-text");
  const [listError, setListError] = useState<string | null>(null);
  if (!settings) return null;

  const models = settings.openrouter.models;
  const live = models.filter((m) => m.availableNow);
  const curated = models.filter((m) => !m.availableNow);
  const active = models.find((m) => m.id === settings.openrouter.activeModel);
  const liveAt = settings.openrouter.liveFetchedAt;
  const liveCount = settings.openrouter.liveCount;

  const handleRefresh = async () => {
    setListError(null);
    try {
      await refreshOpenRouterModels(filter, true);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Erro ao atualizar lista.");
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-ag-border bg-ag-surface-1 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <FieldLabel>Modelo OpenRouter (free + visão)</FieldLabel>
        <button
          type="button"
          onClick={() => void handleRefresh()}
          disabled={saving}
          className="inline-flex items-center gap-1 text-[10px] text-ag-accent hover:underline disabled:opacity-50"
          title="Buscar lista na API OpenRouter (mesmos filtros do site)"
        >
          <RefreshCw className={`h-3 w-3 ${saving ? "animate-spin" : ""}`} />
          Atualizar lista
        </button>
      </div>

      <div className="flex flex-wrap gap-1">
        {(
          [
            ["vision-text", "Imagem → texto"],
            ["vision-image", "Imagem → imagem"],
            ["vision-any", "Qualquer visão"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            disabled={saving}
            onClick={() => {
              setFilter(id);
              void refreshOpenRouterModels(id, false).catch((err: unknown) => {
                setListError(err instanceof Error ? err.message : "Erro ao filtrar.");
              });
            }}
            className={`text-[10px] px-2 py-0.5 rounded-full border ${
              filter === id
                ? "border-ag-accent text-ag-accent bg-ag-accent/10"
                : "border-ag-border text-ag-muted hover:text-ag-text"
            }`}
          >
            {label}
          </button>
        ))}
        <a
          href={OPENROUTER_FILTER_URLS[filter]}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-0.5 text-[10px] text-ag-muted hover:text-ag-accent ml-auto"
        >
          Ver no site
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {listError && (
        <p className="text-[10px] text-ag-danger">{listError}</p>
      )}

      <select
        value={settings.openrouter.activeModel}
        disabled={saving}
        onChange={(e) => void setOpenRouterModel(e.target.value)}
        className="w-full text-xs px-2 py-1.5 rounded-md border border-ag-border bg-ag-surface-2 text-ag-text"
      >
        {live.length > 0 && (
          <optgroup label={`Disponíveis agora (${live.length})`}>
            {live.map((m) => (
              <option key={m.id} value={m.id}>
                {m.recommended ? "★ " : ""}
                {m.label}
              </option>
            ))}
          </optgroup>
        )}
        {curated.length > 0 && (
          <optgroup label="Lista fixa (pode estar offline)">
            {curated.map((m) => (
              <option key={m.id} value={m.id}>
                {m.recommended ? "★ " : ""}
                {m.label}
                {m.vision ? "" : " — só texto"}
              </option>
            ))}
          </optgroup>
        )}
      </select>

      <p className="text-[10px] text-ag-muted">
        {active?.description ?? "Modelo customizado."}
        {liveAt && (
          <>
            {" "}
            · Lista API: {liveCount} modelo(s) · {new Date(liveAt).toLocaleString("pt-BR")}
          </>
        )}
      </p>
    </div>
  );
}
