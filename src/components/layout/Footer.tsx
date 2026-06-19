"use client";

import { useAuth } from "../../context/AuthContext";

export function Footer() {
  const { storageMode } = useAuth();

  return (
    <footer className="px-3 sm:px-4 lg:px-5 py-5 mt-6 border-t border-ag-border flex flex-col sm:flex-row justify-between gap-3 text-xs text-ag-muted w-full">
      <span>
        © {new Date().getFullYear()} AuraGrid Intelligence — planejamento premium para moda.
      </span>
      <span className="text-ag-muted/80">
        {storageMode === "postgresql"
          ? "Dados na nuvem (PostgreSQL + armazenamento de mídia)."
          : "Modo dev: dados salvos localmente no navegador."}
      </span>
    </footer>
  );
}
