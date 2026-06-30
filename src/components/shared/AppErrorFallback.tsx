"use client";

import { useMemo } from "react";
import {
  clearAllAuraStudioStorage,
  clearAuraStudioCaptionCache,
} from "../../lib/clientWorkspace/clearStorage";
import { APP_NAME } from "../../lib/appBranding";
import { STORAGE } from "../../lib/storageLegacy";

const ACCESS_TOKEN_KEY = STORAGE.accessToken;

function isCloudSessionLikely(): boolean {
  if (typeof window === "undefined") return false;
  return !!window.localStorage.getItem(ACCESS_TOKEN_KEY) || !!window.localStorage.getItem("auragrid_access_token");
}

export function AppErrorFallback({
  error,
  onReload,
}: {
  error: Error;
  onReload: () => void;
}) {
  const cloudSession = useMemo(() => isCloudSessionLikely(), []);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-ag-bg text-ag-text">
      <div className="max-w-md space-y-4 rounded-xl border border-ag-danger/30 bg-ag-surface-1 p-6">
        <h1 className="text-lg font-semibold text-ag-danger">Erro ao carregar o {APP_NAME}</h1>
        <p className="text-sm text-ag-muted font-mono break-words">{error.message}</p>

        {cloudSession ? (
          <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-ag-text leading-relaxed space-y-1">
            <p>
              <strong>Seus planejamentos estão na nuvem</strong> e não são apagados pelos botões
              abaixo.
            </p>
            <p>
              <strong>Limpar cache de legendas</strong> remove só respostas de IA guardadas no
              navegador (texto reutilizado). Catálogo, posts e planejamentos permanecem no
              servidor.
            </p>
          </div>
        ) : (
          <p className="text-xs text-ag-muted leading-relaxed">
            Na maioria dos casos basta recarregar. Limpar cache remove só respostas de IA
            guardadas no navegador. Apagar dados locais afeta somente este navegador (modo
            offline).
          </p>
        )}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="text-sm font-semibold px-4 py-2 rounded-lg bg-ag-accent text-white cursor-pointer"
            onClick={onReload}
          >
            Recarregar página
          </button>
          <button
            type="button"
            className="text-sm font-medium px-4 py-2 rounded-lg border border-ag-border bg-ag-surface-2 text-ag-text cursor-pointer hover:bg-ag-surface-3"
            onClick={() => {
              clearAuraStudioCaptionCache();
              onReload();
            }}
          >
            Limpar cache de legendas e recarregar
          </button>
          <p className="text-[10px] text-ag-muted px-1">
            Não apaga planejamentos, catálogo nem posts{cloudSession ? " (dados na nuvem)" : ""}.
          </p>

          {!cloudSession && (
            <button
              type="button"
              className="text-xs font-medium px-4 py-2 rounded-lg text-ag-danger cursor-pointer hover:underline"
              onClick={() => {
                const ok = window.confirm(
                  "Isso apaga workspaces, catálogos e planejamentos salvos neste navegador (modo offline). Continuar?"
                );
                if (!ok) return;
                clearAllAuraStudioStorage();
                onReload();
              }}
            >
              Apagar todos os dados locais…
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
