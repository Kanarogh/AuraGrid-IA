"use client";

import { useEffect, useRef } from "react";
import { cn } from "../../lib/cn";
import { useFocusTrap } from "../../lib/useFocusTrap";
import type { AppSection } from "../../lib/sectionMeta";
import type { AccountTab } from "../../lib/appRouting";
import { SidebarBrand } from "./sidebar/SidebarBrand";
import { ClientHub } from "./sidebar/ClientHub";
import { SidebarNav } from "./sidebar/SidebarNav";
import { SidebarFooter } from "./sidebar/SidebarFooter";

export type { AppSection } from "../../lib/sectionMeta";
export {
  getSectionTitle,
  getSectionSubtitle,
  getSectionIcon,
  SECTION_SUBTITLES,
} from "../../lib/sectionMeta";

const SIDEBAR_COLLAPSED_KEY = "auragrid_sidebar_collapsed";

export function loadSidebarCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
}

export function saveSidebarCollapsed(collapsed: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
}

export function AppSidebar({
  active,
  isDashboardActive,
  isAccountActive,
  activeAccountTab,
  onNavigate,
  onNavigateDashboard,
  onNavigateAccount,
  catalogCount,
  brandGemReady,
  brandGemMissingCount = 0,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onMobileClose,
  onClientCreated,
  hasActiveClient,
  usesReferences = true,
  activeClientId,
}: {
  active: AppSection;
  isDashboardActive?: boolean;
  isAccountActive?: boolean;
  activeAccountTab?: AccountTab;
  onNavigate: (id: AppSection) => void;
  onNavigateDashboard?: () => void;
  onNavigateAccount?: (tab: AccountTab) => void;
  catalogCount: number;
  brandGemReady?: boolean;
  brandGemMissingCount?: number;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  onClientCreated?: (clientId: string) => void;
  hasActiveClient: boolean;
  usesReferences?: boolean;
  activeClientId?: string;
}) {
  const asideRef = useRef<HTMLElement>(null);
  const isCollapsed = collapsed && !mobileOpen;

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onMobileClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen, onMobileClose]);

  useFocusTrap(asideRef, mobileOpen);

  useEffect(() => {
    if (!mobileOpen || !asideRef.current) return;
    const focusable = asideRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusable[0]?.focus();
  }, [mobileOpen]);

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          aria-label="Fechar menu"
          onClick={onMobileClose}
        />
      )}

      <aside
        ref={asideRef}
        className={cn(
          "fixed lg:sticky top-0 z-50 lg:z-30 h-[100dvh] shrink-0 border-r border-ag-border bg-ag-surface-1 flex flex-col transition-all duration-200",
          isCollapsed ? "w-[var(--ag-sidebar-width-collapsed)]" : "w-[min(100vw-1rem,var(--ag-sidebar-width-expanded))] lg:w-[var(--ag-sidebar-width-expanded)]",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
        aria-label="Menu lateral"
      >
        <SidebarBrand collapsed={isCollapsed} onMobileClose={onMobileClose} />

        <ClientHub
          collapsed={isCollapsed}
          onClientCreated={onClientCreated}
          brandGemReady={brandGemReady}
        />

        <SidebarNav
          active={active}
          isDashboardActive={isDashboardActive}
          isAccountActive={isAccountActive}
          activeAccountTab={activeAccountTab}
          collapsed={isCollapsed}
          hasActiveClient={hasActiveClient}
          usesReferences={usesReferences}
          activeClientId={activeClientId}
          catalogCount={catalogCount}
          onNavigate={onNavigate}
          onNavigateDashboard={onNavigateDashboard}
          onNavigateAccount={onNavigateAccount}
          onMobileClose={onMobileClose}
        />

        <SidebarFooter collapsed={isCollapsed} onToggleCollapsed={onToggleCollapsed} />
      </aside>
    </>
  );
}
