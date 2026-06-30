"use client";

import { APP_NAME } from "../../lib/appBranding";
import { AuraLogo } from "../brand/AuraLogo";

export function WorkspaceLoadErrorPanel({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 ag-auth-mesh text-ag-text">
      <div className="max-w-md space-y-4 rounded-xl border border-ag-warning/30 bg-ag-surface-1 p-6">
        <AuraLogo variant="stacked" iconSize={40} />
        <h1 className="text-lg font-semibold text-ag-warning">
          Não foi possível carregar seus dados
        </h1>
        <p className="text-sm text-ag-muted">{message}</p>
        <p className="text-xs text-ag-muted leading-relaxed">
          Seus planejamentos continuam no servidor do {APP_NAME}. Este erro costuma ser temporário
          (migration pendente ou instabilidade). Tente recarregar em alguns segundos.
        </p>
        <button
          type="button"
          className="text-sm font-semibold px-4 py-2 rounded-lg bg-ag-accent text-ag-accent-fg cursor-pointer"
          onClick={onRetry}
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
