"use client";

import { LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { cn } from "../../lib/cn";

export function AppLogoutButton() {
  const { storageMode, user, logout } = useAuth();

  if (storageMode !== "postgresql" || !user) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => void logout()}
      title={`Sair (${user.displayName})`}
      aria-label={`Sair (${user.displayName})`}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ag-focus-ring",
        "bg-ag-surface-2 text-ag-text border border-ag-border hover:bg-ag-surface-3"
      )}
    >
      <LogOut className="h-3.5 w-3.5 shrink-0" />
      <span className="hidden sm:inline truncate max-w-[10rem]">Sair ({user.displayName})</span>
    </button>
  );
}
