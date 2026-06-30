"use client";

import { X } from "lucide-react";
import { APP_NAME_SHORT, APP_TAGLINE } from "../../../lib/appBranding";
import { cn } from "../../../lib/cn";

export function SidebarBrand({
  collapsed,
  onMobileClose,
}: {
  collapsed: boolean;
  onMobileClose?: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 border-b border-ag-border shrink-0",
        collapsed ? "justify-center p-3" : "px-4 py-3"
      )}
    >
      <div
        className="h-9 w-9 rounded-xl text-ag-accent-fg flex items-center justify-center font-display font-bold text-lg shrink-0 shadow-sm"
        style={{
          background: "linear-gradient(135deg, var(--ag-accent), var(--ag-accent-strong))",
        }}
      >
        A
      </div>
      {!collapsed && (
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-semibold text-ag-text leading-tight tracking-tight truncate">
            {APP_NAME_SHORT}
          </p>
          <p className="text-[11px] leading-snug text-ag-muted line-clamp-2">
            {APP_TAGLINE}
          </p>
        </div>
      )}
      {!collapsed && onMobileClose && (
        <button
          type="button"
          onClick={onMobileClose}
          className="lg:hidden p-2 rounded-lg text-ag-muted hover:bg-ag-surface-2 hover:text-ag-text cursor-pointer shrink-0"
          aria-label="Fechar menu"
        >
          <X className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
