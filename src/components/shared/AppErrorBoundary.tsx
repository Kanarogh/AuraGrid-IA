"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { clearAllAuraGridStorage } from "../../lib/clientWorkspace/clearStorage";

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
            <button
              type="button"
              className="text-sm font-semibold px-4 py-2 rounded-lg bg-ag-accent text-white cursor-pointer"
              onClick={() => {
                clearAllAuraGridStorage();
                window.location.reload();
              }}
            >
              Limpar dados de clientes e recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
