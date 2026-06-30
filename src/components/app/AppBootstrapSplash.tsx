"use client";

import { Loader2 } from "lucide-react";
import { AuraLogo } from "../brand/AuraLogo";

export type BootstrapStatus = "connecting" | "workspace" | "redirecting";

const MESSAGES: Record<BootstrapStatus, string> = {
  connecting: "Conectando…",
  workspace: "Carregando workspace na nuvem…",
  redirecting: "Redirecionando…",
};

export function AppBootstrapSplash({ status = "connecting" }: { status?: BootstrapStatus }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 ag-auth-mesh text-ag-muted">
      <AuraLogo variant="stacked" iconSize={56} />
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-ag-accent" />
        <p className="text-sm">{MESSAGES[status]}</p>
      </div>
    </div>
  );
}
