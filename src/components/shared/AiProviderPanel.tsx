import { Cpu, RefreshCw } from "lucide-react";
import { providerDisplayName, type AiProviderId } from "../../lib/aiSettings";
import { useAiSettings } from "../../hooks/useAiSettings";
import { Alert } from "../ui/Alert";
import { Badge } from "../ui/Badge";
import { FieldLabel } from "../ui/Input";

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
            plataforma (não precisa editar o .env a cada troca).
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
                  {!p.configured ? " (sem chave no .env)" : ""}
                </option>
              ))}
            </select>
          </div>

          {activeProviderOption && (
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
              <Badge tone={activeProviderOption.configured ? "success" : "danger"} dot>
                {activeProviderOption.configured ? "Chave OK" : "Sem chave"}
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

          {settings?.activeProvider === "deepseek" && (
            <p className="text-xs text-ag-muted leading-relaxed rounded-lg border border-ag-border bg-ag-surface-1 px-3 py-2">
              <strong className="text-ag-text">DeepSeek</strong> não lê imagens na API oficial. Para
              indexar catálogo e gerar legendas com foto, deixe também{" "}
              <strong>GROQ_API_KEY</strong> ou <strong>GEMINI_API_KEY</strong> no .env — o servidor
              usa uma delas automaticamente para visão; o DeepSeek continua útil para refinar texto.
            </p>
          )}

          {settings?.activeProvider === "openrouter" && (
            <OpenRouterModelSelect />
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

function OpenRouterModelSelect() {
  const { settings, saving, setOpenRouterModel } = useAiSettings();
  if (!settings) return null;

  return (
    <div className="space-y-1.5 rounded-lg border border-ag-border bg-ag-surface-1 px-3 py-2">
      <FieldLabel>Modelo OpenRouter</FieldLabel>
      <select
        value={settings.openrouter.activeModel}
        disabled={saving}
        onChange={(e) => void setOpenRouterModel(e.target.value)}
        className="w-full text-xs px-2 py-1.5 rounded-md border border-ag-border bg-ag-surface-2 text-ag-text"
      >
        {settings.openrouter.models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.recommended ? "★ " : ""}
            {m.label}
            {m.vision ? "" : " — só texto"}
          </option>
        ))}
      </select>
      <p className="text-[10px] text-ag-muted">
        {settings.openrouter.models.find((m) => m.id === settings.openrouter.activeModel)
          ?.description ?? "Modelo customizado."}
      </p>
    </div>
  );
}
