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
import { WorkspaceHero } from "../layout/WorkspaceHero";

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
      <WorkspaceHero
        eyebrow="Conta"
        sectionTitle="Configurações da conta"
        subtitle="Preferências globais do workspace — independentes do cliente ativo."
      >
        <div className="mt-5">
          <TabNav tabs={tabs} active={accountTab} onChange={handleTabChange} />
        </div>
      </WorkspaceHero>

      <div className={cn("animate-ag-fade-in")}>
        {accountTab === "team" && canManageTeam && <TeamMembersPanel />}
        {accountTab === "appearance" && <AppearanceSettingsPanel />}
        {accountTab === "ai" && canManageTeam && <AiProviderPanel />}
      </div>
    </div>
  );
}
