"use client";

import { useRef, useState } from "react";
import { LogOut, MoreHorizontal, PanelLeftClose, PanelLeftOpen, RotateCcw } from "lucide-react";
import { cn } from "../../../lib/cn";
import { useAuth } from "../../../context/AuthContext";
import { confirmDialog } from "../../../lib/confirmDialog";
import type { AppSection } from "../../../lib/sectionMeta";
import { WorkspaceStatusBar } from "../WorkspaceStatusBar";
import { FloatingPopover } from "../../ui/FloatingPopover";

export function SidebarFooter({
  collapsed,
  hasActiveClient,
  brandGemReady,
  brandGemMissingCount,
  onOpenSettings,
  onReset,
  onToggleCollapsed,
}: {
  collapsed: boolean;
  hasActiveClient: boolean;
  brandGemReady?: boolean;
  brandGemMissingCount?: number;
  onOpenSettings: (section: AppSection) => void;
  onReset: () => void;
  onToggleCollapsed: () => void;
}) {
  const { storageMode, user, logout } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);

  const handleReset = async () => {
    setMoreOpen(false);
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
    <div
      className={cn(
        "border-t border-ag-border p-2 sm:p-3 space-y-1.5 shrink-0 pb-[max(0.5rem,env(safe-area-inset-bottom))]",
        collapsed && "flex flex-col items-center"
      )}
    >
      <WorkspaceStatusBar
        brandGemReady={brandGemReady}
        brandGemMissingCount={brandGemMissingCount}
        collapsed={collapsed}
        onOpenSettings={onOpenSettings}
      />

      <div className={cn(collapsed ? "" : "w-full")}>
        <button
          ref={moreRef}
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          aria-expanded={moreOpen}
          aria-haspopup="menu"
          title="Mais opções"
          className={cn(
            "flex items-center gap-2 text-xs text-ag-muted hover:text-ag-text hover:bg-ag-surface-3 rounded-lg transition-colors cursor-pointer max-lg:min-h-[44px]",
            collapsed ? "p-2" : "w-full px-3 py-2"
          )}
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
          {!collapsed && <span>Mais opções</span>}
        </button>
        <FloatingPopover
          anchorRef={moreRef}
          open={moreOpen}
          onClose={() => setMoreOpen(false)}
          placement="top-start"
          matchAnchorWidth={!collapsed}
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
                setMoreOpen(false);
                void logout();
              }}
              className="w-full px-3 py-2 text-left hover:bg-ag-surface-2 cursor-pointer flex items-center gap-2"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair ({user.displayName})
            </button>
          )}
        </FloatingPopover>
      </div>

      <button
        type="button"
        onClick={onToggleCollapsed}
        className={cn(
          "hidden lg:flex items-center gap-2 text-xs text-ag-muted hover:text-ag-text hover:bg-ag-surface-3 rounded-lg transition-colors cursor-pointer",
          collapsed ? "p-2" : "w-full px-3 py-2"
        )}
      >
        {collapsed ? (
          <PanelLeftOpen className="h-4 w-4" />
        ) : (
          <>
            <PanelLeftClose className="h-4 w-4" />
            <span>Recolher menu</span>
          </>
        )}
      </button>
    </div>
  );
}
