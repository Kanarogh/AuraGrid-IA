"use client";

import { useRef, useState } from "react";
import { LogOut, MoreHorizontal, RotateCcw } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { confirmDialog } from "../../lib/confirmDialog";
import { cn } from "../../lib/cn";
import { FloatingPopover } from "../ui/FloatingPopover";

export function AppMoreOptionsMenu({
  hasActiveClient,
  onReset,
}: {
  hasActiveClient: boolean;
  onReset: () => void;
}) {
  const { storageMode, user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const handleReset = async () => {
    setOpen(false);
    if (
      !(await confirmDialog({
        title: "Reiniciar roteiro ativo?",
        message:
          "Isso apaga posts, Canva e catálogo do roteiro ativo. Roteiros arquivados são preservados.",
        variant: "danger",
        confirmLabel: "Continuar",
      }))
    ) {
      return;
    }
    if (
      !(await confirmDialog({
        title: "Confirmação final",
        message: "Esta ação não pode ser desfeita. Deseja realmente reiniciar?",
        variant: "danger",
        confirmLabel: "Reiniciar agora",
      }))
    ) {
      return;
    }
    onReset();
  };

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        aria-label="Mais opções"
        title="Mais opções"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center justify-center p-2 rounded-lg transition-all cursor-pointer ag-focus-ring",
          "bg-ag-surface-2 text-ag-text border border-ag-border hover:bg-ag-surface-3"
        )}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      <FloatingPopover
        anchorRef={anchorRef}
        open={open}
        onClose={() => setOpen(false)}
        placement="bottom-start"
        matchAnchorWidth={false}
        backdrop
        className="py-1 text-xs min-w-[11rem]"
        role="menu"
      >
        <button
          type="button"
          role="menuitem"
          disabled={!hasActiveClient}
          onClick={() => void handleReset()}
          className="w-full px-3 py-2 text-left text-ag-danger hover:bg-ag-danger/10 cursor-pointer disabled:opacity-40 flex items-center gap-2"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reiniciar roteiro
        </button>
        {storageMode === "postgresql" && user && (
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void logout();
            }}
            className="w-full px-3 py-2 text-left hover:bg-ag-surface-2 cursor-pointer flex items-center gap-2"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair ({user.displayName})
          </button>
        )}
      </FloatingPopover>
    </>
  );
}
