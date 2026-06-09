import type { ComponentType } from "react";
import {
  Grid,
  LayoutGrid,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  ScanSearch,
  Settings,
  ShoppingBag,
  Sliders,
  Sparkles,
} from "lucide-react";
import { Badge } from "../ui/Badge";
import { cn } from "../../lib/cn";
import { ClientSwitcher } from "./ClientSwitcher";

export type AppSection =
  | "posts"
  | "canva_grid"
  | "feed_simulator"
  | "catalog"
  | "reference_finder"
  | "settings";

export type NavItem = {
  id: AppSection;
  label: string;
  description?: string;
  icon: ComponentType<{ className?: string }>;
  badge?: number | string;
  badgeTone?: "neutral" | "warning";
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Planejamento",
    items: [
      {
        id: "posts",
        label: "Roteiros e legendas",
        description: "Calendário, IA e revisão",
        icon: Sliders,
      },
    ],
  },
  {
    title: "Produção visual",
    items: [
      {
        id: "canva_grid",
        label: "Grid Canva",
        description: "Montagem multi-página",
        icon: LayoutGrid,
      },
      {
        id: "feed_simulator",
        label: "Feed 3×3",
        description: "Prévia do Instagram",
        icon: Grid,
      },
    ],
  },
  {
    title: "Acervo",
    items: [
      {
        id: "catalog",
        label: "Catálogo",
        description: "Referências e indexação",
        icon: ShoppingBag,
      },
      {
        id: "reference_finder",
        label: "Buscar referência",
        description: "Foto → código no catálogo",
        icon: ScanSearch,
      },
    ],
  },
  {
    title: "Sistema",
    items: [
      {
        id: "settings",
        label: "Configurações",
        description: "Tom da IA e provedor",
        icon: Settings,
      },
    ],
  },
];

const SECTION_TITLES: Record<AppSection, string> = {
  posts: "Roteiros e legendas",
  canva_grid: "Grid Canva",
  feed_simulator: "Simulador de feed",
  catalog: "Catálogo de referências",
  reference_finder: "Buscar referência",
  settings: "Configurações",
};

export function getSectionTitle(section: AppSection): string {
  return SECTION_TITLES[section];
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
}) {
  const groups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.map((item) => {
      if (item.id === "catalog") {
        return { ...item, badge: catalogCount || undefined };
      }
      if (item.id === "settings" && brandGemReady === false) {
        return {
          ...item,
          description: "Tom da IA — campos pendentes",
          badge: brandGemMissingCount > 0 ? brandGemMissingCount : "!",
          badgeTone: "warning" as const,
        };
      }
      if (item.id === "settings" && brandGemReady === true) {
        return { ...item, description: "Gem configurado · provedor IA" };
      }
      return item;
    }),
  }));

  const gemStatusLabel =
    brandGemReady === undefined
      ? null
      : brandGemReady
        ? "Gem pronto"
        : brandGemMissingCount > 0
          ? `Gem — ${brandGemMissingCount} campo${brandGemMissingCount !== 1 ? "s" : ""} pendente${brandGemMissingCount !== 1 ? "s" : ""}`
          : "Gem incompleto";

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div
        className={cn(
          "flex items-center gap-3 border-b border-ag-border shrink-0",
          collapsed ? "justify-center p-4" : "px-5 py-4"
        )}
      >
        <div className="h-9 w-9 rounded-xl bg-ag-accent text-white flex items-center justify-center font-display italic font-bold text-lg shrink-0">
          A
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold text-ag-text leading-tight">AuraGrid</p>
            <p className="text-[10px] uppercase tracking-widest text-ag-muted font-mono">
              Intelligence
            </p>
          </div>
        )}
      </div>

      <ClientSwitcher collapsed={collapsed} onClientCreated={onClientCreated} />

      <nav className="flex-1 overflow-y-auto py-4 px-2 ag-scrollbar-thin space-y-5">
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
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onNavigate(item.id);
                        onMobileClose();
                      }}
                      title={
                        collapsed
                          ? item.id === "settings" && brandGemReady === false
                            ? `${item.label} — Gem incompleto`
                            : item.label
                          : undefined
                      }
                      className={cn(
                        "w-full flex items-center gap-3 rounded-xl text-left transition-colors cursor-pointer relative",
                        collapsed ? "justify-center p-2.5" : "px-3 py-2.5",
                        isActive
                          ? "bg-ag-accent text-white shadow-sm"
                          : "text-ag-text hover:bg-ag-surface-3"
                      )}
                    >
                      <span className="relative shrink-0">
                        <Icon
                          className={cn(
                            "h-4 w-4",
                            isActive ? "text-white" : "text-ag-muted"
                          )}
                        />
                        {collapsed && item.id === "settings" && brandGemReady === false && (
                          <span
                            className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-ag-warning ring-2 ring-ag-surface-1"
                            aria-hidden
                          />
                        )}
                      </span>
                      {!collapsed && (
                        <span className="flex-1 min-w-0">
                          <span className="text-sm font-medium block truncate">{item.label}</span>
                          {item.description && (
                            <span
                              className={cn(
                                "text-[10px] block truncate",
                                isActive ? "text-white/80" : "text-ag-muted"
                              )}
                            >
                              {item.description}
                            </span>
                          )}
                        </span>
                      )}
                      {!collapsed && item.badge !== undefined && (
                        <span
                          className={cn(
                            "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md",
                            item.badgeTone === "warning"
                              ? isActive
                                ? "bg-white/25 text-white"
                                : "bg-ag-warning/15 text-ag-warning"
                              : isActive
                                ? "bg-white/20 text-white"
                                : "bg-ag-surface-3 text-ag-muted"
                          )}
                        >
                          {item.badge}
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
        {gemStatusLabel && (
          <button
            type="button"
            onClick={() => {
              if (!brandGemReady) {
                onNavigate("settings");
                onMobileClose();
              }
            }}
            title={gemStatusLabel}
            className={cn(
              "transition-opacity",
              !brandGemReady && "cursor-pointer hover:opacity-90",
              brandGemReady && "cursor-default",
              collapsed ? "p-0" : "w-full"
            )}
          >
            <Badge
              tone={brandGemReady ? "success" : "warning"}
              dot
              className={cn(
                collapsed ? "p-2 rounded-lg" : "w-full justify-center normal-case text-[10px]"
              )}
            >
              {collapsed ? (
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
              ) : (
                gemStatusLabel
              )}
            </Badge>
          </button>
        )}
        {!collapsed && (
          <Badge tone={apiStatusTone} dot className="w-full justify-center normal-case text-[10px]">
            {apiStatusLabel}
          </Badge>
        )}
        <button
          type="button"
          onClick={onReset}
          title="Reiniciar dados"
          className={cn(
            "flex items-center gap-2 text-xs text-ag-danger hover:bg-ag-danger/10 rounded-lg transition-colors cursor-pointer",
            collapsed ? "p-2" : "w-full px-3 py-2"
          )}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {!collapsed && <span>Reiniciar sistema</span>}
        </button>
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
        className={cn(
          "fixed lg:sticky top-0 z-50 lg:z-30 h-screen shrink-0 border-r border-ag-border bg-ag-surface-1 flex flex-col transition-all duration-200",
          collapsed ? "w-[72px]" : "w-[260px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
