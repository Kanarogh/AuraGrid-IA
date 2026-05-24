import { Menu, Moon, Sun } from "lucide-react";
import type { AppSection } from "./AppSidebar";
import { getSectionTitle } from "./AppSidebar";
import { Button } from "../ui/Button";
import { AiUsagePanel } from "../shared/AiUsagePanel";

export function AppTopBar({
  activeSection,
  clientName,
  onOpenMenu,
  isDark,
  onToggleTheme,
}: {
  activeSection: AppSection;
  clientName: string;
  onOpenMenu: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 h-14 border-b border-ag-border bg-ag-surface-1/95 backdrop-blur-md flex items-center justify-between gap-4 px-4 lg:px-6 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMenu}
          className="lg:hidden p-2 rounded-lg text-ag-muted hover:bg-ag-surface-2 hover:text-ag-text cursor-pointer"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-ag-muted font-mono hidden sm:block">
            Workspace
          </p>
          <h1 className="text-base font-semibold text-ag-text truncate">
            {getSectionTitle(activeSection)}
          </h1>
          <p className="text-[11px] text-ag-muted truncate">{clientName}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <AiUsagePanel />
        <Button
          variant="secondary"
          size="sm"
          onClick={onToggleTheme}
          title={isDark ? "Modo claro" : "Modo escuro"}
          aria-label={isDark ? "Modo claro" : "Modo escuro"}
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  );
}
