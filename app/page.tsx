"use client";

import dynamic from "next/dynamic";

const AppShell = dynamic(() => import("./AppShell"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-ag-bg text-ag-muted">
      Carregando…
    </div>
  ),
});

export default function HomePage() {
  return <AppShell />;
}
