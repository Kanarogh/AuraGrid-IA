import { useEffect, useRef, useState } from "react";
import {
  LogOut,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
} from "lucide-react";
import { Badge } from "../ui/Badge";
import { cn } from "../../lib/cn";
import { ClientSwitcher } from "./ClientSwitcher";
import { WorkspaceStatusBar } from "./WorkspaceStatusBar";
import { useAuth } from "../../context/AuthContext";
import {
  NAV_GROUPS,
  type AppSection,
  type NavItem,
} from "../../lib/sectionMeta";
import { confirmDialog } from "../../lib/confirmDialog";
import { useFocusTrap } from "../../lib/useFocusTrap";

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
  onNavigate,
  catalogCount,
  brandGemReady,
  brandGemMissingCount = 0,
  apiStatusLabel,
  apiStatusTone,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onMobileClose,
  onReset,
  onClientCreated,
  hasActiveClient,
}: {
  active: AppSection;
  onNavigate: (id: AppSection) => void;
  catalogCount: number;
  brandGemReady?: boolean;
  brandGemMissingCount?: number;
  apiStatusLabel: string;
  apiStatusTone: "success" | "warning" | "danger";
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  onReset: () => void;
  onClientCreated?: () => void;
  hasActiveClient: boolean;
}) {
  const { storageMode, user, logout } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const asideRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);

  const groups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.map((item) => {
      if (item.id === "catalog" && catalogCount > 0) {
        return { ...item, badge: catalogCount } as NavItem & { badge?: number };
      }
      return item;
    }),
  }));

  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [moreOpen]);

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
    const first = focusable[0];
    first?.focus();
  }, [mobileOpen]);

  const handleReset = async () => {
    setMoreOpen(false);
    if (
      !(await confirmDialog({
        title: "Reiniciar roteiro ativo?",
        message:
          "Isso apaga posts, Canva e catálogo do roteiro ativo. Roteiros arquivados são preservados.",
        variant: "danger",
        confirmLabel: "Continuar",
      }))
    ) {
      return;
    }
    if (
      !(await confirmDialog({
        title: "Confirmação final",
        message: "Esta ação não pode ser desfeita. Deseja realmente reiniciar?",
        variant: "danger",
        confirmLabel: "Reiniciar agora",
      }))
    ) {
      return;
    }
    onReset();
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div
        className={cn(
          "flex items-center gap-3 border-b border-ag-border shrink-0",
          collapsed ? "justify-center p-4" : "px-5 py-4"
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
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold text-ag-text leading-tight tracking-tight">
              AuraGrid
            </p>
            <p className="text-[10px] uppercase tracking-widest text-ag-muted font-mono">
              Intelligence
            </p>
          </div>
        )}
      </div>

      <ClientSwitcher collapsed={collapsed} onClientCreated={onClientCreated} />

      <nav
        className="flex-1 overflow-y-auto py-4 px-2 ag-scrollbar-thin space-y-5"
        aria-label="Navegação principal"
      >
        {groups.map((group) => (
          <div key={group.title}>
            {!collapsed && (
              <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-ag-muted">
                {group.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = active === item.id;
                const badge = "badge" in item ? (item as { badge?: number }).badge : undefined;
                const disabled = !hasActiveClient;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      disabled={disabled}
                      aria-current={isActive ? "page" : undefined}
                      onClick={() => {
                        if (disabled) return;
                        onNavigate(item.id);
                        onMobileClose();
                      }}
                      title={
                        collapsed
                          ? disabled
                            ? "Crie um cliente primeiro"
                            : item.label
                          : disabled
                            ? "Crie um cliente para acessar"
                            : undefined
                      }
                      className={cn(
                        "group w-full flex items-center gap-3 rounded-xl text-left transition-all duration-200 relative",
                        collapsed ? "justify-center p-2.5" : "px-3 py-2.5",
                        disabled && "opacity-45 cursor-not-allowed",
                        !disabled && "cursor-pointer",
                        isActive
                          ? "bg-ag-accent text-ag-accent-fg shadow-sm"
                          : !disabled && "text-ag-text hover:bg-ag-surface-3"
                      )}
                    >
                      {isActive && !collapsed && (
                        <span
                          className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-ag-accent-fg/80"
                          aria-hidden
                        />
                      )}
                      <span className="relative shrink-0">
                        <Icon
                          className={cn(
                            "h-4 w-4 transition-colors",
                            isActive ? "text-ag-accent-fg" : "text-ag-muted group-hover:text-ag-text"
                          )}
                        />
                      </span>
                      {!collapsed && (
                        <span
                          className={cn(
                            "flex-1 min-w-0",
                            item.nested && "pl-1 border-l-2 border-ag-border/40 ml-0.5"
                          )}
                        >
                          <span className="text-sm font-medium block truncate">{item.label}</span>
                          {item.description && (
                            <span
                              className={cn(
                                "text-[10px] block truncate",
                                isActive ? "text-ag-accent-fg/80" : "text-ag-muted"
                              )}
                            >
                              {item.description}
                            </span>
                          )}
                        </span>
                      )}
                      {!collapsed && badge !== undefined && (
                        <span
                          className={cn(
                            "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md",
                            isActive
                              ? "bg-ag-accent-fg/20 text-ag-accent-fg"
                              : "bg-ag-surface-3 text-ag-muted"
                          )}
                        >
                          {badge}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div
        className={cn(
          "border-t border-ag-border p-3 space-y-2 shrink-0",
          collapsed && "flex flex-col items-center"
        )}
      >
        <WorkspaceStatusBar
          brandGemReady={brandGemReady}
          brandGemMissingCount={brandGemMissingCount}
          apiStatusLabel={apiStatusLabel}
          apiStatusTone={apiStatusTone}
          storageMode={storageMode}
          collapsed={collapsed}
          onOpenSettings={onNavigate}
        />

        <div className={cn("relative", collapsed ? "" : "w-full")} ref={moreRef}>
          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            aria-expanded={moreOpen}
            aria-haspopup="menu"
            title="Mais opções"
            className={cn(
              "flex items-center gap-2 text-xs text-ag-muted hover:text-ag-text hover:bg-ag-surface-3 rounded-lg transition-colors cursor-pointer",
              collapsed ? "p-2" : "w-full px-3 py-2"
            )}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
            {!collapsed && <span>Mais opções</span>}
          </button>
          {moreOpen && (
            <div
              role="menu"
              className={cn(
                "absolute bottom-full mb-1 rounded-lg border border-ag-border bg-ag-surface-1 shadow-lg py-1 text-xs z-50 min-w-[11rem]",
                collapsed ? "left-0" : "left-0 right-0"
              )}
            >
              <button
                type="button"
                role="menuitem"
                disabled={!hasActiveClient}
                onClick={() => void handleReset()}
                className="w-full px-3 py-2 text-left text-ag-danger hover:bg-ag-danger/10 cursor-pointer disabled:opacity-40 flex items-center gap-2"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reiniciar roteiro
              </button>
              {storageMode === "postgresql" && user && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMoreOpen(false);
                    void logout();
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-ag-surface-2 cursor-pointer flex items-center gap-2"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sair ({user.displayName})
                </button>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleCollapsed}
          className={cn(
            "hidden lg:flex items-center gap-2 text-xs text-ag-muted hover:text-ag-text hover:bg-ag-surface-3 rounded-lg transition-colors cursor-pointer",
            collapsed ? "p-2" : "w-full px-3 py-2"
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <>
              <PanelLeftClose className="h-4 w-4" />
              <span>Recolher menu</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

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
          "fixed lg:sticky top-0 z-50 lg:z-30 h-screen shrink-0 border-r border-ag-border bg-ag-surface-1 flex flex-col transition-all duration-200",
          collapsed ? "w-[72px]" : "w-[260px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
        aria-label="Menu lateral"
      >
        {sidebarContent}
      </aside>
    </>
  );
}
