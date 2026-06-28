"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import type { AppSection } from "../lib/sectionMeta";
import {
  canAccessAppSection,
  canManageClients,
  canManageTeam,
  permissionsForClient,
} from "../lib/permissions/navFilter";
import type { ClientPermissions } from "../lib/permissions/types";
import { canPerformAction } from "../lib/permissions/roleTemplates";

type PermissionsContextValue = {
  canAccessSection: (clientId: string, section: AppSection, minLevel?: "read" | "write") => boolean;
  canPerform: (clientId: string, action: keyof ClientPermissions["actions"]) => boolean;
  canManageTeam: () => boolean;
  canManageClients: (clientId?: string) => boolean;
  getClientPermissions: (clientId: string) => ClientPermissions | null;
  isOwner: boolean;
};

const PermissionsContext = createContext<PermissionsContextValue | null>(null);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const value = useMemo<PermissionsContextValue>(() => {
    const profile = user;
    return {
      canAccessSection: (clientId, section, minLevel = "read") =>
        canAccessAppSection(profile, clientId, section, minLevel),
      canPerform: (clientId, action) => {
        const perms = permissionsForClient(profile, clientId);
        return perms ? canPerformAction(perms, action) : false;
      },
      canManageTeam: () => canManageTeam(profile),
      canManageClients: (clientId) => canManageClients(profile, clientId),
      getClientPermissions: (clientId) => permissionsForClient(profile, clientId),
      isOwner: profile?.accountRole === "owner",
    };
  }, [user]);

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

export function usePermissions() {
  const ctx = useContext(PermissionsContext);
  if (!ctx) throw new Error("usePermissions must be used within PermissionsProvider");
  return ctx;
}

export function usePermissionsOptional() {
  return useContext(PermissionsContext);
}
