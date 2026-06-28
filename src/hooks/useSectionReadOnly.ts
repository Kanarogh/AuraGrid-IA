import { useCallback } from "react";
import { usePermissions } from "../context/PermissionsContext";
import type { AppSection } from "../lib/sectionMeta";

/** Combines archived-period read-only with RBAC section write level. */
export function useSectionReadOnly(archivedReadOnly: boolean, clientId: string | null) {
  const permissions = usePermissions();

  return useCallback(
    (section: AppSection) => {
      if (archivedReadOnly) return true;
      if (!clientId) return false;
      return !permissions.canAccessSection(clientId, section, "write");
    },
    [archivedReadOnly, clientId, permissions]
  );
}
