"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  Image,
  LayoutGrid,
  LayoutDashboard,
  Sparkles,
  Type,
} from "lucide-react";
import type { AppSection } from "../../lib/sectionMeta";
import type { ClientMeta } from "../../lib/clientWorkspace";
import type { DashboardMetrics } from "../../hooks/useDashboardMetrics";
import { WorkspacePageHeader } from "../layout/WorkspacePageHeader";
import { PostsWorkflowBar } from "../posts/PostsWorkflowBar";
import { DashboardStatCard } from "./DashboardStatCard";
import { DashboardQuickActions } from "./DashboardQuickActions";
import { DashboardClientGrid } from "./DashboardClientGrid";
import { NewClientModal } from "../clients/NewClientModal";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Alert } from "../ui/Alert";
import { Skeleton } from "../ui/Skeleton";
import { cn } from "../../lib/cn";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export function DashboardView({
  userName,
  activeClient,
  clients,
  activeClientId,
  activePeriodLabel,
  isReadOnly,
  metrics,
  isLoading,
  onContinueRoteiro,
  onNavigateSection,
  onSelectClient,
  onConfigureGem,
  onClientCreated,
}: {
  userName?: string | null;
  activeClient: ClientMeta;
  clients: ClientMeta[];
  activeClientId: string;
  activePeriodLabel: string;
  isReadOnly: boolean;
  metrics: DashboardMetrics;
  isLoading?: boolean;
  onContinueRoteiro: () => void;
  onNavigateSection: (section: AppSection) => void;
  onSelectClient: (clientId: string) => void;
  onConfigureGem: () => void;
  onClientCreated?: (clientId: string) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const { captionBatchStats, referenceCount, canvaImageCount, canvaPageCount, brandGemReady, brandGemMissingCount } =
    metrics;

  const greeting = useMemo(() => getGreeting(), []);
  const displayName = userName?.trim() || activeClient.name;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-4">
      <section
        className={cn(
          "relative overflow-hidden rounded-2xl border border-ag-border/60",
          "bg-ag-surface-1 shadow-[var(--ag-shadow-lg)] ag-studio-mesh p-5 sm:p-6 animate-ag-fade-in"
        )}
      >
        <WorkspacePageHeader
          eyebrow={`${greeting}${userName ? `, ${userName.split(" ")[0]}` : ""}`}
          sectionTitle={displayName}
          subtitle={`Período ${activePeriodLabel}${isReadOnly ? " · somente leitura" : ""}`}
          icon={LayoutDashboard}
          suppressTitle
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {brandGemReady ? (
                <Badge tone="success">Gem pronto</Badge>
              ) : (
                <Badge tone="warning">{brandGemMissingCount} campos no Gem</Badge>
              )}
              {isReadOnly && <Badge tone="neutral">Arquivado</Badge>}
              <Button variant="accent" size="md" onClick={onContinueRoteiro}>
                Continuar roteiro
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          }
        />
      </section>

      {!brandGemReady && (
        <Alert tone="warning" title="Gem da marca incompleto">
          Configure a voz da marca para gerar legendas com qualidade.{" "}
          <button
            type="button"
            onClick={onConfigureGem}
            className="font-semibold text-ag-accent hover:underline cursor-pointer"
          >
            Abrir configurações
          </button>
        </Alert>
      )}

      <section className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <DashboardStatCard
          label="Referências"
          value={String(referenceCount)}
          hint={`${captionBatchStats.catalogIndexed} indexadas para IA`}
          icon={Image}
          style={{ animationDelay: "0ms" }}
        />
        <DashboardStatCard
          label="Legendas"
          value={`${captionBatchStats.confirmed}/${captionBatchStats.total}`}
          hint={
            captionBatchStats.pending > 0
              ? `${captionBatchStats.pending} pendentes de geração`
              : "Todas geradas ou sem foto"
          }
          icon={Type}
          tone={captionBatchStats.pending > 0 ? "warning" : "success"}
          style={{ animationDelay: "40ms" }}
        />
        <DashboardStatCard
          label="Gem da marca"
          value={brandGemReady ? "Pronto" : String(brandGemMissingCount)}
          hint={
            brandGemReady
              ? "Configuração completa para legendas"
              : "campos obrigatórios faltando"
          }
          icon={Sparkles}
          tone={brandGemReady ? "success" : "warning"}
          style={{ animationDelay: "80ms" }}
        />
        <DashboardStatCard
          label="Grid Canva"
          value={String(canvaImageCount)}
          hint={`${canvaPageCount} página${canvaPageCount === 1 ? "" : "s"} · fotos nos slots`}
          icon={LayoutGrid}
          style={{ animationDelay: "120ms" }}
        />
      </section>

      <section className="space-y-3 animate-ag-fade-in">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-ag-accent">
            Produção
          </p>
          <h2 className="font-display text-lg font-semibold text-ag-text mt-1">
            Pipeline do roteiro
          </h2>
        </div>
        <PostsWorkflowBar stats={captionBatchStats} />
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 xl:gap-8">
        <div className="xl:col-span-7">
          <DashboardQuickActions onNavigateSection={onNavigateSection} />
        </div>
        <div className="xl:col-span-5">
          <DashboardClientGrid
            clients={clients}
            activeClientId={activeClientId}
            onSelectClient={onSelectClient}
            onCreateClient={() => setModalOpen(true)}
          />
        </div>
      </div>

      <NewClientModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(clientId) => {
          onClientCreated?.(clientId);
          setModalOpen(false);
        }}
      />
    </div>
  );
}
