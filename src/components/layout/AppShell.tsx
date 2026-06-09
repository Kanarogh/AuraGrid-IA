import { useState, type ReactNode } from "react";
import type { AppSection } from "./AppSidebar";
import { AppSidebar } from "./AppSidebar";
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
  children: ReactNode;
  footer?: ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-ag-bg text-ag-text">
      <AppSidebar
        active={activeSection}
        onNavigate={onNavigate}
        catalogCount={catalogCount}
        brandGemReady={brandGemReady}
        brandGemMissingCount={brandGemMissingCount}
        apiStatusLabel={apiStatusLabel}
        apiStatusTone={apiStatusTone}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((c) => !c)}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
        onReset={onReset}
        onClientCreated={onClientCreated}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <AppTopBar
          activeSection={activeSection}
          clientName={clientName}
          onOpenMenu={() => setMobileNavOpen(true)}
          isDark={isDark}
          onToggleTheme={onToggleTheme}
        />

        <main className="flex-1 overflow-auto ag-page-mesh">
          <SectionTransition
            transitionKey={activeSection}
            className="w-full max-w-[100rem] mx-auto px-4 sm:px-5 lg:px-6 py-6 space-y-5"
          >
            {children}
          </SectionTransition>
          {footer}
        </main>
      </div>
    </div>
  );
}
