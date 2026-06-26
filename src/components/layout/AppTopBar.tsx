"use client";

import { ChevronRight, Menu, Moon, Sun } from "lucide-react";
import type { AppSection } from "../../lib/sectionMeta";
import { getSectionSubtitle, getSectionTitle } from "../../lib/sectionMeta";
import { IconButton } from "../ui/IconButton";
import { AiUsagePanel } from "../shared/AiUsagePanel";
import { WorkspaceStatusBar } from "./WorkspaceStatusBar";
import { AppLogoutButton } from "./AppLogoutButton";

export function AppTopBar({
  activeSection,
  isDashboardActive,
  clientName,
  onOpenMenu,
  isDark,
  onToggleTheme,
  onOpenSettings,
  menuButtonRef,
  brandGemReady,
  brandGemMissingCount,
  hasActiveClient,
}: {
  activeSection: AppSection;
  isDashboardActive?: boolean;
  clientName: string;
  onOpenMenu: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenSettings?: () => void;
  menuButtonRef?: React.RefObject<HTMLButtonElement | null>;
  brandGemReady?: boolean;
  brandGemMissingCount?: number;
  hasActiveClient?: boolean;
}) {
  const sectionTitle = isDashboardActive ? "Dashboard" : getSectionTitle(activeSection);
  const subtitle = isDashboardActive
    ? `Visão geral de ${clientName}`
    : getSectionSubtitle(activeSection);

  return (
    <header className="sticky top-0 z-20 border-b border-ag-border ag-glass shrink-0 min-h-[var(--ag-topbar-height)]">
      <div className="flex items-center justify-between gap-4 px-4 lg:px-6 min-h-[var(--ag-topbar-height)] py-2">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={onOpenMenu}
            className="lg:hidden mt-0.5 p-2 rounded-lg text-ag-muted hover:bg-ag-surface-2 hover:text-ag-text cursor-pointer ag-focus-ring shrink-0"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <nav
              className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-ag-muted"
              aria-label="Localização"
            >
              <span className="truncate max-w-[8rem] sm:max-w-[12rem]" title={clientName}>
                {clientName}
              </span>
              <ChevronRight className="h-3 w-3 opacity-60 shrink-0" aria-hidden />
              <span className="text-ag-accent truncate">{sectionTitle}</span>
            </nav>
            <h1 className="text-base sm:text-lg font-semibold text-ag-text truncate font-display tracking-tight mt-0.5">
              {sectionTitle}
            </h1>
            <p className="hidden sm:block text-xs text-ag-muted truncate mt-0.5 max-w-xl">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {hasActiveClient && brandGemReady !== undefined && onOpenSettings && (
            <WorkspaceStatusBar
              variant="topbar"
              brandGemReady={brandGemReady}
              brandGemMissingCount={brandGemMissingCount}
              onOpenSettings={(_section) => onOpenSettings?.()}
            />
          )}

          <AiUsagePanel onOpenSettings={onOpenSettings} />

          <AppLogoutButton />

          <IconButton
            label={isDark ? "Modo claro" : "Modo escuro"}
            variant="surface"
            onClick={onToggleTheme}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </IconButton>
        </div>
      </div>
    </header>
  );
}
