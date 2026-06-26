"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "../../../lib/cn";

export function SidebarFooter({
  collapsed,
  onToggleCollapsed,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  return (
    <div
      className={cn(
        "border-t border-ag-border p-2 sm:p-3 shrink-0 pb-[max(0.5rem,env(safe-area-inset-bottom))]",
        collapsed && "flex flex-col items-center"
      )}
    >
      <button
        type="button"
        onClick={onToggleCollapsed}
        className={cn(
          "hidden lg:flex items-center gap-2 text-xs text-ag-muted hover:text-ag-text hover:bg-ag-surface-3 rounded-lg transition-colors cursor-pointer max-lg:min-h-[44px]",
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
