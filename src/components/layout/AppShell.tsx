"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { AppSection } from "../../lib/sectionMeta";
import {
  AppSidebar,
  loadSidebarCollapsed,
  saveSidebarCollapsed,
} from "./AppSidebar";
import { AppTopBar } from "./AppTopBar";
import { ClientSwitchOverlay } from "../app/ClientSwitchOverlay";

export function AppShell({
  activeSection,
  isDashboardActive,
  onNavigate,
  onNavigateDashboard,
  catalogCount,
  brandGemReady,
  brandGemMissingCount,
  isDark,
  onToggleTheme,
  clientName,
  onClientCreated,
  hasActiveClient,
  usesReferences = true,
  activeClientId,
  children,
  footer,
}: {
  clientName: string;
  activeSection: AppSection;
  isDashboardActive?: boolean;
  onNavigate: (section: AppSection) => void;
  onNavigateDashboard?: () => void;
  catalogCount: number;
  brandGemReady?: boolean;
  brandGemMissingCount?: number;
  isDark: boolean;
  onToggleTheme: () => void;
  onClientCreated?: (clientId: string) => void;
  hasActiveClient: boolean;
  usesReferences?: boolean;
  activeClientId?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setSidebarCollapsed(loadSidebarCollapsed());
  }, []);

  const toggleCollapsed = () => {
    setSidebarCollapsed((c) => {
      const next = !c;
      saveSidebarCollapsed(next);
      return next;
    });
  };

  const closeMobileNav = () => {
    setMobileNavOpen(false);
    menuButtonRef.current?.focus();
  };

  return (
    <div className="min-h-screen flex bg-ag-bg text-ag-text">
      <a href="#main-content" className="ag-skip-link">
        Ir ao conteúdo
      </a>

      <AppSidebar
        active={activeSection}
        isDashboardActive={isDashboardActive}
        onNavigate={onNavigate}
        onNavigateDashboard={onNavigateDashboard}
        catalogCount={catalogCount}
        brandGemReady={brandGemReady}
        brandGemMissingCount={brandGemMissingCount}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={toggleCollapsed}
        mobileOpen={mobileNavOpen}
        onMobileClose={closeMobileNav}
        onClientCreated={onClientCreated}
        hasActiveClient={hasActiveClient}
        usesReferences={usesReferences}
        activeClientId={activeClientId}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <AppTopBar
          activeSection={activeSection}
          isDashboardActive={isDashboardActive}
          clientName={clientName}
          onOpenMenu={() => setMobileNavOpen(true)}
          isDark={isDark}
          onToggleTheme={onToggleTheme}
          onOpenSettings={() => onNavigate("settings")}
          menuButtonRef={menuButtonRef}
          brandGemReady={brandGemReady}
          brandGemMissingCount={brandGemMissingCount}
          hasActiveClient={hasActiveClient}
        />

        <main
          id="main-content"
          ref={mainRef}
          className="relative flex-1 overflow-auto ag-page-mesh"
          tabIndex={-1}
        >
          <ClientSwitchOverlay />
          <div className="w-full max-w-[100rem] mx-auto px-4 sm:px-5 lg:px-6 py-6 ag-workspace-section">
            {children}
          </div>
          {footer}
        </main>
      </div>
    </div>
  );
}
