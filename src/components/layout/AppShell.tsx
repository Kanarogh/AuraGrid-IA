import { useEffect, useRef, useState, type ReactNode } from "react";
import type { AppSection } from "../../lib/sectionMeta";
import {
  AppSidebar,
  loadSidebarCollapsed,
  saveSidebarCollapsed,
} from "./AppSidebar";
import { AppTopBar } from "./AppTopBar";
import { SectionTransition } from "../ui/Motion";

export function AppShell({
  activeSection,
  onNavigate,
  catalogCount,
  brandGemReady,
  brandGemMissingCount,
  apiStatusLabel,
  apiStatusTone,
  isDark,
  onToggleTheme,
  clientName,
  onReset,
  onClientCreated,
  hasActiveClient,
  children,
  footer,
}: {
  clientName: string;
  activeSection: AppSection;
  onNavigate: (section: AppSection) => void;
  catalogCount: number;
  brandGemReady?: boolean;
  brandGemMissingCount?: number;
  apiStatusLabel: string;
  apiStatusTone: "success" | "warning" | "danger";
  isDark: boolean;
  onToggleTheme: () => void;
  onReset: () => void;
  onClientCreated?: () => void;
  hasActiveClient: boolean;
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
        onNavigate={onNavigate}
        catalogCount={catalogCount}
        brandGemReady={brandGemReady}
        brandGemMissingCount={brandGemMissingCount}
        apiStatusLabel={apiStatusLabel}
        apiStatusTone={apiStatusTone}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={toggleCollapsed}
        mobileOpen={mobileNavOpen}
        onMobileClose={closeMobileNav}
        onReset={onReset}
        onClientCreated={onClientCreated}
        hasActiveClient={hasActiveClient}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <AppTopBar
          activeSection={activeSection}
          clientName={clientName}
          onOpenMenu={() => setMobileNavOpen(true)}
          isDark={isDark}
          onToggleTheme={onToggleTheme}
          onOpenSettings={() => onNavigate("settings")}
          menuButtonRef={menuButtonRef}
        />

        <main
          id="main-content"
          ref={mainRef}
          className="flex-1 overflow-auto ag-page-mesh"
          tabIndex={-1}
        >
          <SectionTransition
            transitionKey={activeSection}
            className="w-full max-w-[100rem] mx-auto px-4 sm:px-5 lg:px-6 py-6 ag-workspace-section"
          >
            {children}
          </SectionTransition>
          {footer}
        </main>
      </div>
    </div>
  );
}
