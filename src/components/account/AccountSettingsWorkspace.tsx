"use client";

import { Cpu, Palette, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import type { AccountTab } from "../../lib/appRouting";
import { buildAccountPath } from "../../lib/appRouting";
import { cn } from "../../lib/cn";
import { AiProviderPanel } from "../shared/AiProviderPanel";
import { AppearanceSettingsPanel } from "../shared/AppearanceSettingsPanel";
import { TeamMembersPanel } from "../team/TeamMembersPanel";
import { TabNav } from "../ui/Tabs";

export function AccountSettingsWorkspace({
  accountTab,
  onAccountTabChange,
  canManageTeam,
}: {
  accountTab: AccountTab;
  onAccountTabChange: (tab: AccountTab) => void;
  canManageTeam: boolean;
}) {
  const router = useRouter();

  const tabs = [
    ...(canManageTeam ? [{ id: "team" as const, label: "Equipe", icon: Users }] : []),
    { id: "appearance" as const, label: "Aparência", icon: Palette },
    ...(canManageTeam ? [{ id: "ai" as const, label: "IA", icon: Cpu }] : []),
  ];

  const handleTabChange = (tab: AccountTab) => {
    onAccountTabChange(tab);
    router.push(buildAccountPath({ tab }));
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="rounded-2xl border border-ag-border/70 bg-ag-surface-1 shadow-[var(--ag-shadow-sm)] p-4 sm:p-6">
        <p className="text-[10px] font-mono uppercase tracking-wider text-ag-muted font-semibold mb-1">
          Conta
        </p>
        <h2 className="font-display text-xl font-semibold text-ag-text">
          Configurações da conta
        </h2>
        <p className="text-sm text-ag-muted mt-1">
          Preferências globais do workspace — independentes do cliente ativo.
        </p>

        <div className="mt-5">
          <TabNav tabs={tabs} active={accountTab} onChange={handleTabChange} />
        </div>
      </div>

      <div className={cn("animate-ag-fade-in")}>
        {accountTab === "team" && canManageTeam && <TeamMembersPanel />}
        {accountTab === "appearance" && <AppearanceSettingsPanel />}
        {accountTab === "ai" && canManageTeam && <AiProviderPanel />}
      </div>
    </div>
  );
}
