"use client";

import { useRef, useState } from "react";
import { LogOut, MoreHorizontal } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { cn } from "../../lib/cn";
import { FloatingPopover } from "../ui/FloatingPopover";

export function AppMoreOptionsMenu() {
  const { storageMode, user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  if (storageMode !== "postgresql" || !user) {
    return null;
  }

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
          onClick={() => {
            setOpen(false);
            void logout();
          }}
          className="w-full px-3 py-2 text-left hover:bg-ag-surface-2 cursor-pointer flex items-center gap-2"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sair ({user.displayName})
        </button>
      </FloatingPopover>
    </>
  );
}
