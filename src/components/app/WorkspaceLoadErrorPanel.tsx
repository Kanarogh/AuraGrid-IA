"use client";

import { APP_NAME } from "../../lib/appBranding";

export function WorkspaceLoadErrorPanel({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-ag-bg text-ag-text">
      <div className="max-w-md space-y-4 rounded-xl border border-amber-500/30 bg-ag-surface-1 p-6">
        <h1 className="text-lg font-semibold text-amber-700 dark:text-amber-300">
          Não foi possível carregar seus dados
        </h1>
        <p className="text-sm text-ag-muted">{message}</p>
        <p className="text-xs text-ag-muted leading-relaxed">
          Seus planejamentos continuam no servidor do {APP_NAME}. Este erro costuma ser temporário
          (migration pendente ou instabilidade). Tente recarregar em alguns segundos.
        </p>
        <button
          type="button"
          className="text-sm font-semibold px-4 py-2 rounded-lg bg-ag-accent text-white cursor-pointer"
          onClick={onRetry}
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
