"use client";

import { LayoutDashboard } from "lucide-react";
import { cn } from "../../../lib/cn";
import {
  getNavGroups,
  type AppSection,
  type NavItem,
} from "../../../lib/sectionMeta";

export function SidebarNav({
  active,
  isDashboardActive,
  collapsed,
  hasActiveClient,
  usesReferences,
  catalogCount,
  onNavigate,
  onNavigateDashboard,
  onMobileClose,
}: {
  active: AppSection;
  isDashboardActive?: boolean;
  collapsed: boolean;
  hasActiveClient: boolean;
  usesReferences?: boolean;
  catalogCount: number;
  onNavigate: (id: AppSection) => void;
  onNavigateDashboard?: () => void;
  onMobileClose?: () => void;
}) {
  const groups = getNavGroups(usesReferences).map((g) => ({
    ...g,
    items: g.items.map((item) => {
      if (item.id === "catalog" && catalogCount > 0) {
        return { ...item, badge: catalogCount } as NavItem & { badge?: number };
      }
      return item;
    }),
  }));

  const renderNavButton = (
    item: NavItem & { badge?: number },
    isActive: boolean,
    disabled: boolean
  ) => {
    const Icon = item.icon;
    const badge = item.badge;

    return (
      <button
        type="button"
        disabled={disabled}
        aria-current={isActive ? "page" : undefined}
        title={collapsed ? (disabled ? "Crie um cliente primeiro" : item.label) : item.description}
        onClick={() => {
          if (disabled) return;
          onNavigate(item.id);
          onMobileClose?.();
        }}
        className={cn(
          "group w-full flex items-center gap-3 rounded-xl text-left transition-all duration-200 relative ag-focus-ring",
          collapsed ? "justify-center p-2.5" : "px-3 py-2.5 max-lg:min-h-[44px]",
          disabled && "opacity-45 cursor-not-allowed",
          !disabled && "cursor-pointer",
          isActive
            ? "bg-ag-accent text-ag-accent-fg shadow-sm"
            : !disabled && "text-ag-text hover:bg-ag-surface-3/80"
        )}
      >
        {isActive && !collapsed && (
          <span
            className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-ag-accent-fg/80"
            aria-hidden
          />
        )}
        {isActive && collapsed && (
          <span
            className="absolute -right-0.5 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-ag-accent-fg"
            aria-hidden
          />
        )}
        <span className="relative shrink-0">
          <Icon
            className={cn(
              "h-[18px] w-[18px] transition-colors",
              isActive ? "text-ag-accent-fg" : "text-ag-muted group-hover:text-ag-text"
            )}
          />
        </span>
        {!collapsed && (
          <span className="flex-1 min-w-0 text-sm font-medium truncate">{item.label}</span>
        )}
        {!collapsed && badge !== undefined && (
          <span
            className={cn(
              "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md shrink-0",
              isActive ? "bg-ag-accent-fg/20 text-ag-accent-fg" : "bg-ag-surface-3 text-ag-muted"
            )}
          >
            {badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <nav
      className="flex-1 overflow-y-auto py-3 px-2 ag-scrollbar-thin space-y-4 overscroll-contain min-h-0"
      aria-label="Navegação principal"
    >
      <div>
        {!collapsed && (
          <p className="px-3 mb-1.5 text-[11px] font-medium text-ag-muted">Visão geral</p>
        )}
        <ul className="space-y-0.5">
          <li>
            <button
              type="button"
              onClick={() => {
                onNavigateDashboard?.();
                onMobileClose?.();
              }}
              title={collapsed ? "Dashboard" : undefined}
              className={cn(
                "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors cursor-pointer ag-focus-ring",
                isDashboardActive
                  ? "bg-ag-accent text-ag-accent-fg shadow-sm"
                  : "text-ag-text hover:bg-ag-surface-3/80",
                collapsed && "justify-center px-2"
              )}
            >
              <LayoutDashboard className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span className="truncate">Dashboard</span>}
            </button>
          </li>
        </ul>
      </div>

      {groups.map((group) => (
        <div key={group.title}>
          {!collapsed && (
            <p className="px-3 mb-1.5 text-[11px] font-medium text-ag-muted">
              {group.navLabel ?? group.title}
            </p>
          )}
          <ul
            className={cn(
              "space-y-0.5",
              !collapsed &&
                group.variant === "planning" &&
                "rounded-2xl bg-ag-surface-2/40 p-1.5 border border-ag-border/40"
            )}
          >
            {group.items.map((item) => {
              const isActive = !isDashboardActive && active === item.id;
              const disabled = !hasActiveClient;
              return (
                <li key={item.id}>
                  {renderNavButton(item as NavItem & { badge?: number }, isActive, disabled)}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
