"use client";

import { X } from "lucide-react";
import { APP_TAGLINE } from "../../../lib/appBranding";
import { AuraLogo } from "../../brand/AuraLogo";
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
      {collapsed ? (
        <AuraLogo variant="icon" iconSize={36} />
      ) : (
        <div className="min-w-0 flex-1">
          <AuraLogo variant="horizontal" iconSize={36} />
          <p className="text-[11px] leading-snug text-ag-muted line-clamp-2 mt-1 pl-12">
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
