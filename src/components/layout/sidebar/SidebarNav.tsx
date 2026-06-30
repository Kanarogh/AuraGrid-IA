"use client";

import { LayoutDashboard } from "lucide-react";
import { cn } from "../../../lib/cn";
import { usePermissionsOptional } from "../../../context/PermissionsContext";
import {
  getAccountNavItems,
  getNavGroups,
  type AppSection,
  type AccountNavItem,
  type NavItem,
} from "../../../lib/sectionMeta";
import { canAccessAppSection } from "../../../lib/permissions/navFilter";
import { useAuth } from "../../../context/AuthContext";
import type { AccountTab } from "../../../lib/appRouting";

export function SidebarNav({
  active,
  isDashboardActive,
  isAccountActive,
  activeAccountTab,
  collapsed,
  hasActiveClient,
  usesReferences,
  catalogCount,
  activeClientId,
  onNavigate,
  onNavigateDashboard,
  onNavigateAccount,
  onMobileClose,
}: {
  active: AppSection;
  isDashboardActive?: boolean;
  isAccountActive?: boolean;
  activeAccountTab?: AccountTab;
  collapsed: boolean;
  hasActiveClient: boolean;
  usesReferences?: boolean;
  catalogCount: number;
  activeClientId?: string;
  onNavigate: (id: AppSection) => void;
  onNavigateDashboard?: () => void;
  onNavigateAccount?: (tab: AccountTab) => void;
  onMobileClose?: () => void;
}) {
  const { user } = useAuth();
  const perms = usePermissionsOptional();
  const canManageTeam = perms?.canManageTeam() ?? false;

  const canAccess = (section: AppSection) => {
    if (!activeClientId || !user) return true;
    if (perms) return perms.canAccessSection(activeClientId, section, "read");
    return canAccessAppSection(user, activeClientId, section, "read");
  };

  const groups = getNavGroups(usesReferences, canAccess).map((g) => ({
    ...g,
    items: g.items.map((item) => {
      if (item.id === "catalog" && catalogCount > 0) {
        return { ...item, badge: catalogCount } as NavItem & { badge?: number };
      }
      return item;
    }),
  }));

  const accountItems = getAccountNavItems({ canManageTeam });

  const renderNavButton = (
    item: NavItem & { badge?: number },
    isActive: boolean,
    disabled: boolean,
    onClick: () => void
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
          onClick();
          onMobileClose?.();
        }}
        className={cn(
          "group w-full flex items-center gap-3 rounded-xl text-left transition-all duration-200 relative ag-focus-ring",
          collapsed ? "justify-center p-2.5" : "px-3 py-2.5 max-lg:min-h-[44px]",
          disabled && "opacity-45 cursor-not-allowed",
          !disabled && "cursor-pointer",
          isActive
            ? "ag-sidebar-nav-active text-ag-text"
            : !disabled && "text-ag-text hover:bg-ag-surface-3/80"
        )}
      >
        <span className="relative shrink-0">
          <Icon
            className={cn(
              "h-[18px] w-[18px] transition-colors",
              isActive ? "text-[var(--ag-brand-purple)]" : "text-ag-muted group-hover:text-ag-text"
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
              isActive ? "bg-[var(--ag-sidebar-active-bg)] text-[var(--ag-brand-purple)]" : "bg-ag-surface-3 text-ag-muted"
            )}
          >
            {badge}
          </span>
        )}
      </button>
    );
  };

  const renderAccountButton = (item: AccountNavItem, isActive: boolean) => {
    const Icon = item.icon;
    return (
      <button
        type="button"
        aria-current={isActive ? "page" : undefined}
        title={collapsed ? item.label : item.description}
        onClick={() => {
          onNavigateAccount?.(item.id);
          onMobileClose?.();
        }}
        className={cn(
          "group w-full flex items-center gap-3 rounded-xl text-left transition-all duration-200 relative ag-focus-ring cursor-pointer",
          collapsed ? "justify-center p-2.5" : "px-3 py-2.5 max-lg:min-h-[44px]",
          isActive
            ? "ag-sidebar-nav-active text-ag-text"
            : "text-ag-text hover:bg-ag-surface-3/80"
        )}
      >
        <Icon
          className={cn(
            "h-[18px] w-[18px] shrink-0 transition-colors",
            isActive ? "text-[var(--ag-brand-purple)]" : "text-ag-muted group-hover:text-ag-text"
          )}
        />
        {!collapsed && (
          <span className="flex-1 min-w-0 text-sm font-medium truncate">{item.label}</span>
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
              aria-current={isDashboardActive ? "page" : undefined}
              className={cn(
                "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors cursor-pointer ag-focus-ring",
                isDashboardActive
                  ? "ag-sidebar-nav-active text-ag-text"
                  : "text-ag-text hover:bg-ag-surface-3/80",
                collapsed && "justify-center px-2"
              )}
            >
              <LayoutDashboard
                className={cn(
                  "h-[18px] w-[18px] shrink-0",
                  isDashboardActive ? "text-[var(--ag-brand-purple)]" : "text-ag-muted"
                )}
              />
              {!collapsed && <span className="truncate">Dashboard</span>}
            </button>
          </li>
        </ul>
      </div>

      {accountItems.length > 0 && (
        <div>
          {!collapsed && (
            <p className="px-3 mb-1.5 text-[11px] font-medium text-ag-muted">Conta</p>
          )}
          <ul className="space-y-0.5">
            {accountItems.map((item) => (
              <li key={item.id}>
                {renderAccountButton(item, Boolean(isAccountActive && activeAccountTab === item.id))}
              </li>
            ))}
          </ul>
        </div>
      )}

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
                "rounded-xl bg-ag-surface-2/40 p-1.5 border border-ag-border/40"
            )}
          >
            {group.items.map((item) => {
              const isActive =
                !isDashboardActive && !isAccountActive && active === item.id;
              const disabled = !hasActiveClient;
              return (
                <li key={item.id}>
                  {renderNavButton(
                    item as NavItem & { badge?: number },
                    isActive,
                    disabled,
                    () => onNavigate(item.id)
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
