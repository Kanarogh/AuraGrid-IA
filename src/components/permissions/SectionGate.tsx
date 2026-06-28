"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePermissionsOptional } from "../../context/PermissionsContext";
import type { AppSection } from "../../lib/sectionMeta";
import { buildDashboardPath } from "../../lib/appRouting";

type SectionGateProps = {
  clientId: string | null;
  section: AppSection;
  children: ReactNode;
};

export function SectionGate({ clientId, section, children }: SectionGateProps) {
  const permissions = usePermissionsOptional();

  if (!clientId) return null;

  if (permissions && !permissions.canAccessSection(clientId, section, "read")) {
    return (
      <div className="ag-workspace-section flex flex-col items-center justify-center gap-4 py-16 text-center">
        <h2 className="text-lg font-semibold text-[var(--ag-text)]">Sem acesso a esta área</h2>
        <p className="max-w-md text-sm text-[var(--ag-text-muted)]">
          Você não tem permissão para acessar esta seção neste cliente. Contacte o administrador da
          equipe.
        </p>
        <Link
          href={buildDashboardPath()}
          className="text-sm font-medium text-[var(--ag-accent)] hover:underline"
        >
          Voltar ao dashboard
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
