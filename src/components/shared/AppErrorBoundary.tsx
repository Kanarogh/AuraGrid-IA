"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import {
  clearAllAuraGridStorage,
  clearAuraGridCaptionCache,
} from "../../lib/clientWorkspace/clearStorage";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class AppErrorBoundary extends Component<Props, State> {
  declare props: Props;
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("AuraGrid render error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-ag-bg text-ag-text">
          <div className="max-w-md space-y-4 rounded-xl border border-ag-danger/30 bg-ag-surface-1 p-6">
            <h1 className="text-lg font-semibold text-ag-danger">Erro ao carregar o app</h1>
            <p className="text-sm text-ag-muted">{this.state.error.message}</p>
            <p className="text-xs text-ag-muted leading-relaxed">
              Na maioria dos casos basta recarregar. Limpar cache remove só respostas de IA
              guardadas no navegador. Apagar todos os dados locais é irreversível no modo offline.
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="text-sm font-semibold px-4 py-2 rounded-lg bg-ag-accent text-white cursor-pointer"
                onClick={() => window.location.reload()}
              >
                Recarregar página
              </button>
              <button
                type="button"
                className="text-sm font-medium px-4 py-2 rounded-lg border border-ag-border bg-ag-surface-2 text-ag-text cursor-pointer hover:bg-ag-surface-3"
                onClick={() => {
                  clearAuraGridCaptionCache();
                  window.location.reload();
                }}
              >
                Limpar cache de legendas e recarregar
              </button>
              <button
                type="button"
                className="text-xs font-medium px-4 py-2 rounded-lg text-ag-danger cursor-pointer hover:underline"
                onClick={() => {
                  const ok = window.confirm(
                    "Isso apaga todos os workspaces, catálogos e roteiros salvos neste navegador. " +
                      "Dados na nuvem (login) não são apagados, mas você precisará sincronizar de novo. " +
                      "Continuar?"
                  );
                  if (!ok) return;
                  clearAllAuraGridStorage();
                  window.location.reload();
                }}
              >
                Apagar todos os dados locais…
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
