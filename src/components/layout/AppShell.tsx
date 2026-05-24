import { useState, type ReactNode } from "react";
import type { AppSection } from "./AppSidebar";
import { AppSidebar } from "./AppSidebar";
import { AppTopBar } from "./AppTopBar";
export function AppShell({
  activeSection,
  onNavigate,
  catalogCount,
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
          <div className="w-full max-w-[100rem] mx-auto px-4 sm:px-5 lg:px-6 py-5 space-y-5">{children}</div>
          {footer}
        </main>
      </div>
    </div>
  );
}
