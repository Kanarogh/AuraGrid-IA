import { useAiSettings } from "../../hooks/useAiSettings";
import { FieldLabel } from "../ui/Input";
import { Alert } from "../ui/Alert";

export function OllamaModelPicker({
  variant = "settings",
  disabled = false,
}: {
  variant?: "settings" | "popover";
  disabled?: boolean;
}) {
  const { settings, saving, setOllamaModel } = useAiSettings();
  if (!settings) return null;

  const { ollama } = settings;
  const isDisabled = disabled || saving;
  const selectClass =
    variant === "popover"
      ? "w-full text-[11px] px-2 py-1.5 rounded-md border border-ag-border bg-ag-surface-2 text-ag-text cursor-pointer"
      : "w-full text-xs px-2 py-1.5 rounded-md border border-ag-border bg-ag-surface-2 text-ag-text";

  const visionModels = ollama.models.filter((m) => m.vision);
  const active = ollama.models.find((m) => m.id === ollama.activeModel);

  if (!ollama.reachable) {
    return (
      <Alert tone="warning" title="Ollama local">
        App Ollama não detectado em <code className="font-mono text-[10px]">127.0.0.1:11434</code>.
        Abra o Ollama e clique em Atualizar no painel de IA.
      </Alert>
    );
  }

  if (ollama.models.length === 0) {
    return (
      <Alert tone="warning" title="Ollama local">
        Nenhum modelo local instalado. Execute{" "}
        <code className="font-mono text-[10px]">ollama pull gemma4</code> no terminal.
      </Alert>
    );
  }

  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        {variant === "settings" && <FieldLabel>Modelo local instalado</FieldLabel>}
        <select
          value={ollama.runtimeModel ?? "__env__"}
          disabled={isDisabled}
          onChange={(e) => {
            const v = e.target.value;
            void setOllamaModel(v === "__env__" ? null : v);
          }}
          className={selectClass}
        >
          <option value="__env__">Padrão do .env ({ollama.envModel})</option>
          {visionModels.map((m) => (
            <option key={m.id} value={m.id}>
              ★ {m.label}
            </option>
          ))}
          {ollama.models
            .filter((m) => !m.vision)
            .map((m) => (
              <option key={m.id} value={m.id} disabled>
                {m.label} — sem visão
              </option>
            ))}
        </select>
        <p className="text-[10px] text-ag-muted">
          {active?.description ??
            "Só aparecem modelos no disco (sem *:cloud). Match e legenda exigem visão."}
        </p>
      </div>
      {visionModels.length === 0 && (
        <Alert tone="warning" title="Sem modelo com visão">
          Você tem modelos locais, mas nenhum serve para foto. Instale{" "}
          <code className="font-mono text-[10px]">gemma4</code> ou{" "}
          <code className="font-mono text-[10px]">qwen2.5vl:7b</code>.
        </Alert>
      )}
    </div>
  );
}
