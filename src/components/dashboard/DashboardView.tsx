"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  Coins,
  Cpu,
  Gauge,
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
import { useDashboardAiUsage } from "../../hooks/useDashboardAiUsage";
import { usePermissionsOptional } from "../../context/PermissionsContext";
import { useAuth } from "../../context/AuthContext";

function formatTokens(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(Math.max(0, Math.round(value)));
}

function formatUsdFromMicros(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 1_000_000);
}

const USD_TO_BRL_RATE = Number(process.env.NEXT_PUBLIC_USD_TO_BRL ?? "5.5");

function formatBrlFromMicros(value: number): string {
  const safeRate = Number.isFinite(USD_TO_BRL_RATE) && USD_TO_BRL_RATE > 0 ? USD_TO_BRL_RATE : 5.5;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format((value / 1_000_000) * safeRate);
}

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
  clientSwitchDisabled,
  switchingClientId,
  onContinueWorkspace,
  onNavigateSection,
  onSelectClient,
  onConfigureGem,
  onClientCreated,
  usesReferences = true,
}: {
  userName?: string | null;
  activeClient: ClientMeta;
  clients: ClientMeta[];
  activeClientId: string;
  activePeriodLabel: string;
  isReadOnly: boolean;
  metrics: DashboardMetrics;
  isLoading?: boolean;
  clientSwitchDisabled?: boolean;
  switchingClientId?: string | null;
  onContinueWorkspace: () => void;
  onNavigateSection: (section: AppSection) => void;
  onSelectClient: (clientId: string) => void;
  onConfigureGem: () => void;
  onClientCreated?: (clientId: string) => void;
  usesReferences?: boolean;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const { storageMode } = useAuth();
  const permissions = usePermissionsOptional();
  const canCreateClients =
    storageMode !== "postgresql" || (permissions?.canManageTeam() ?? false);
  const { captionBatchStats, referenceCount, canvaImageCount, canvaPageCount, brandGemReady, brandGemMissingCount } =
    metrics;
  const { data: aiUsage, isLoading: aiUsageLoading, error: aiUsageError, reload: reloadAiUsage } =
    useDashboardAiUsage(activeClientId);

  const greeting = useMemo(() => getGreeting(), []);
  const displayName = userName?.trim() || activeClient.name;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full rounded-xl" />
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
          "relative overflow-hidden rounded-xl border border-ag-border/60",
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
              <Button variant="accent" size="md" onClick={onContinueWorkspace}>
                Continuar workspace
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
        {usesReferences && (
        <DashboardStatCard
          label="Referências"
          value={String(referenceCount)}
          hint={`${captionBatchStats.catalogIndexed} indexadas para IA`}
          icon={Image}
          style={{ animationDelay: "0ms" }}
        />
        )}
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
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-ag-accent">IA</p>
            <h2 className="font-display text-lg font-semibold text-ag-text mt-1">
              Custos e tokens (30 dias)
            </h2>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void reloadAiUsage()}>
            Atualizar
          </Button>
        </div>

        {aiUsageError ? (
          <Alert tone="danger" title="Falha ao carregar uso de IA">
            {aiUsageError}
          </Alert>
        ) : null}

        {aiUsageLoading && !aiUsage ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
        ) : aiUsage ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
              <DashboardStatCard
                label="Tokens"
                value={formatTokens(aiUsage.usage.totals.totalTokens)}
                hint={`${formatTokens(aiUsage.usage.totals.inputTokens)} in · ${formatTokens(aiUsage.usage.totals.outputTokens)} out`}
                icon={Cpu}
              />
              <DashboardStatCard
                label="Custo estimado"
                value={formatBrlFromMicros(aiUsage.usage.totals.estimatedCostMicros)}
                hint={`${formatUsdFromMicros(aiUsage.usage.totals.estimatedCostMicros)} USD · ${formatTokens(aiUsage.usage.totals.calls)} chamadas IA`}
                icon={Coins}
              />
              <DashboardStatCard
                label="Limite interno restante"
                value={
                  aiUsage.usage.internalLimit.tokenRemaining == null
                    ? "—"
                    : formatTokens(aiUsage.usage.internalLimit.tokenRemaining)
                }
                hint={
                  aiUsage.usage.internalLimit.tokenLimit == null
                    ? "Sem limite configurado"
                    : `de ${formatTokens(aiUsage.usage.internalLimit.tokenLimit)} tokens (${aiUsage.usage.internalLimit.source})`
                }
                icon={Gauge}
                tone={
                  aiUsage.usage.internalLimit.tokenLimit != null &&
                  (aiUsage.usage.internalLimit.tokenRemaining ?? 0) === 0
                    ? "warning"
                    : "neutral"
                }
              />
            </div>

            <div className="rounded-xl border border-ag-border bg-ag-surface-1 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-ag-text">Por modelo</h3>
                <span className="text-xs text-ag-muted">{aiUsage.usage.byModel.length} modelos</span>
              </div>
              {aiUsage.usage.byModel.length === 0 ? (
                <p className="text-sm text-ag-muted">Sem consumo registrado nos últimos 30 dias.</p>
              ) : (
                <div className="space-y-2">
                  {aiUsage.usage.byModel.map((row) => (
                    <div
                      key={row.model}
                      className="rounded-xl border border-ag-border/70 bg-ag-surface-2/60 px-3 py-2.5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-mono text-ag-text">{row.model}</p>
                        <p className="text-xs font-semibold text-ag-text">
                          {formatBrlFromMicros(row.estimatedCostMicros)}
                        </p>
                      </div>
                      <p className="text-xs text-ag-muted mt-1">
                        {formatUsdFromMicros(row.estimatedCostMicros)} USD · {formatTokens(row.inputTokens)} in ·{" "}
                        {formatTokens(row.outputTokens)} out · {formatTokens(row.calls)} chamadas
                      </p>
                      <p className="text-xs text-ag-muted">
                        Restante:{" "}
                        {row.tokenRemaining == null ? "—" : `${formatTokens(row.tokenRemaining)} tokens`}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-ag-border bg-ag-surface-1 p-4">
              <h3 className="text-sm font-semibold text-ag-text">Quota Google</h3>
              <p className="text-xs text-ag-muted mt-1">{aiUsage.googleQuota.message}</p>
              <p className="text-xs text-ag-muted mt-1">
                Status: {aiUsage.googleQuota.status}
                {aiUsage.googleQuota.metric ? ` · ${aiUsage.googleQuota.metric}` : ""}
              </p>
            </div>
          </>
        ) : null}
      </section>

      <section className="space-y-3 animate-ag-fade-in">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-ag-accent">
            Produção
          </p>
          <h2 className="font-display text-lg font-semibold text-ag-text mt-1">
            Pipeline do planejamento
          </h2>
        </div>
        <PostsWorkflowBar stats={captionBatchStats} />
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 xl:gap-8">
        <div className="xl:col-span-7">
          <DashboardQuickActions
            onNavigateSection={onNavigateSection}
            usesReferences={usesReferences}
            activeClientId={activeClientId}
          />
        </div>
        <div className="xl:col-span-5">
          <DashboardClientGrid
            clients={clients}
            activeClientId={activeClientId}
            clientSwitchDisabled={clientSwitchDisabled}
            switchingClientId={switchingClientId}
            onSelectClient={onSelectClient}
            onCreateClient={() => setModalOpen(true)}
            showCreateButton={canCreateClients}
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
