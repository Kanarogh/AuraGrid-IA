import { Moon, RotateCcw, Settings, Sparkles, Sun } from "lucide-react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
type ApiStatus = "checking" | "connected" | "disconnected";

export function Header({
  apiStatus,
  aiProviderLabel,
  showConfig,
  onToggleConfig,
  onReset,
  isDark,
  onToggleTheme,
}: {
  apiStatus: ApiStatus;
  aiProviderLabel?: string | null;
  showConfig: boolean;
  onToggleConfig: () => void;
  onReset: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
}) {
  const statusTone =
    apiStatus === "connected"
      ? "success"
      : apiStatus === "checking"
        ? "warning"
        : "danger";

  const statusLabel =
    apiStatus === "connected"
      ? aiProviderLabel
        ? `IA conectada (${aiProviderLabel})`
        : "IA conectada"
      : apiStatus === "checking"
        ? "Verificando…"
        : "API não configurada";

  return (
    <header className="sticky top-0 z-40 border-b border-ag-border ag-glass">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative p-3 rounded-2xl bg-ag-accent text-white shadow-sm">
            <Sparkles className="h-5 w-5" strokeWidth={1.75} />
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-ag-success border-2 border-ag-surface-1" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-ag-text">
                AuraGrid
              </h1>
              <Badge tone="accent">Intelligence</Badge>
            </div>
            <p className="text-sm text-ag-muted mt-0.5 max-w-md">
              Planejamento editorial, match visual de catálogo e legendas com IA.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <Badge tone={statusTone} dot className="normal-case tracking-normal text-xs">
            {statusLabel}
          </Badge>

          <Button
            variant="secondary"
            size="sm"
            onClick={onToggleTheme}
            title={isDark ? "Modo claro" : "Modo escuro"}
            aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
          >
            {isDark ? <Sun className="h-4 w-4 text-ag-warning" /> : <Moon className="h-4 w-4" />}
            <span className="hidden sm:inline">{isDark ? "Claro" : "Escuro"}</span>
          </Button>

          <Button
            variant={showConfig ? "accent" : "secondary"}
            size="sm"
            onClick={onToggleConfig}
            id="btn-toggle-config"
          >
            <Settings className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Configurações</span>
          </Button>

          <Button variant="danger" size="sm" onClick={onReset} id="btn-reset-presets">
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Reiniciar</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
