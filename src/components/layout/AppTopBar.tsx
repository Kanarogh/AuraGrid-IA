"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, Menu, Moon, Palette, Sun } from "lucide-react";
import type { AppSection } from "./AppSidebar";
import { getSectionTitle } from "./AppSidebar";
import { IconButton } from "../ui/IconButton";
import { AccentPicker } from "../shared/AccentPicker";
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
  const [accentOpen, setAccentOpen] = useState(false);
  const accentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!accentOpen) return;
    const onDown = (e: MouseEvent) => {
      if (accentRef.current && !accentRef.current.contains(e.target as Node)) {
        setAccentOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [accentOpen]);

  return (
    <header className="sticky top-0 z-20 h-16 border-b border-ag-border ag-glass flex items-center justify-between gap-4 px-4 lg:px-6 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMenu}
          className="lg:hidden p-2 rounded-lg text-ag-muted hover:bg-ag-surface-2 hover:text-ag-text cursor-pointer ag-focus-ring"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <nav className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-ag-muted">
            <span>Workspace</span>
            <ChevronRight className="h-3 w-3 opacity-60" />
            <span className="text-ag-accent">{getSectionTitle(activeSection)}</span>
          </nav>
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-base font-semibold text-ag-text truncate font-display tracking-tight">
              {getSectionTitle(activeSection)}
            </h1>
            <span
              className="hidden sm:inline-flex items-center rounded-full bg-ag-surface-2 border border-ag-border px-2 py-0.5 text-[11px] text-ag-muted truncate max-w-[14rem]"
              title={clientName}
            >
              {clientName}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <AiUsagePanel />

        <div className="relative" ref={accentRef}>
          <IconButton
            label="Cor de destaque"
            variant="surface"
            onClick={() => setAccentOpen((o) => !o)}
            aria-expanded={accentOpen}
          >
            <Palette className="h-4 w-4" />
          </IconButton>
          {accentOpen && (
            <div className="absolute right-0 top-full mt-2 z-50 rounded-xl border border-ag-border bg-ag-surface-1 p-3 shadow-[var(--ag-shadow-lg)] animate-ag-scale-in">
              <p className="mb-2 text-[10px] font-mono uppercase tracking-widest text-ag-muted">
                Cor de destaque
              </p>
              <AccentPicker variant="row" />
            </div>
          )}
        </div>

        <IconButton
          label={isDark ? "Modo claro" : "Modo escuro"}
          variant="surface"
          onClick={onToggleTheme}
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </IconButton>
      </div>
    </header>
  );
}
