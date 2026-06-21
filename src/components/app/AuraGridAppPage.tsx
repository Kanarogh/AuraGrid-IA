"use client";

import dynamic from "next/dynamic";

const AppShell = dynamic(() => import("../../../app/AppShell"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-ag-bg text-ag-muted">
      Carregando…
    </div>
  ),
});

export default function AuraGridAppPage() {
  return <AppShell />;
}
