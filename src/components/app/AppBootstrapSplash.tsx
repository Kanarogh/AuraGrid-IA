"use client";

import { Loader2 } from "lucide-react";

export type BootstrapStatus = "connecting" | "workspace" | "redirecting";

const MESSAGES: Record<BootstrapStatus, string> = {
  connecting: "Conectando…",
  workspace: "Carregando workspace na nuvem…",
  redirecting: "Redirecionando…",
};

export function AppBootstrapSplash({ status = "connecting" }: { status?: BootstrapStatus }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-ag-bg text-ag-muted">
      <Loader2 className="h-8 w-8 animate-spin text-ag-accent" />
      <p className="text-sm">{MESSAGES[status]}</p>
    </div>
  );
}
