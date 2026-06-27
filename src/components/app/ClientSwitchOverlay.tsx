"use client";

import { Loader2 } from "lucide-react";
import { useClientWorkspace } from "../../context/ClientWorkspaceContext";

/** Overlay sobre o conteúdo principal (sidebar permanece visível). */
export function ClientSwitchOverlay() {
  const { clientSwitch } = useClientWorkspace();

  if (!clientSwitch.isSwitching) return null;

  const label = clientSwitch.targetClientName ?? "cliente";

  return (
    <div
      className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-ag-bg/75 backdrop-blur-[2px] pointer-events-auto"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className="h-8 w-8 animate-spin text-ag-accent" aria-hidden />
      <p className="text-sm text-ag-muted text-center px-6 max-w-sm">
        Carregando informações de{" "}
        <strong className="font-semibold text-ag-text">{label}</strong>
        …
      </p>
    </div>
  );
}
