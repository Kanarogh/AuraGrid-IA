"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, MoreHorizontal, Plus } from "lucide-react";
import { gemInitial } from "../../../lib/brandGem";
import { useClientWorkspace } from "../../../context/ClientWorkspaceContext";
import { usePermissionsOptional } from "../../../context/PermissionsContext";
import type { ClientMeta } from "../../../lib/clientWorkspace";
import { cn } from "../../../lib/cn";
import { confirmDialog } from "../../../lib/confirmDialog";
import { useAppNavigation } from "../../../lib/appRouting";
import { NewClientModal } from "../../clients/NewClientModal";
import { FloatingPopover } from "../../ui/FloatingPopover";
import { ClientOptionsMenu } from "./ClientOptionsMenu";
import { PlanningPeriodControls } from "./PlanningPeriodControls";
import { shortPeriodLabel } from "./planningPeriodUtils";

const CLIENT_HUB_COLLAPSED_KEY = "aurastudio_client_hub_collapsed";

function loadClientHubCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(CLIENT_HUB_COLLAPSED_KEY) === "1";
}

function saveClientHubCollapsed(collapsed: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CLIENT_HUB_COLLAPSED_KEY, collapsed ? "1" : "0");
}

function ClientHubCompactBar({
  onExpand,
}: {
  onExpand: () => void;
}) {
  const { hasActiveClient, activeClient, workspace, clients } = useClientWorkspace();

  const activePeriod =
    workspace.planningPeriods.find((p) => p.id === workspace.activePlanningPeriodId) ??
    workspace.planningPeriods[0];

  if (clients.length === 0) return null;

  return (
    <div className="px-3 py-2 shrink-0 border-b border-ag-border">
      <button
        type="button"
        onClick={onExpand}
        aria-expanded={false}
        title="Expandir clientes e planejamento"
        className="w-full flex items-center gap-2.5 rounded-xl border border-ag-border/70 bg-ag-surface-2/60 px-2.5 py-2 text-left hover:bg-ag-surface-2 transition-colors cursor-pointer min-w-0"
      >
        {hasActiveClient ? (
          <>
            <span
              className="h-8 w-8 rounded-full bg-ag-accent text-ag-accent-fg text-xs font-bold flex items-center justify-center shrink-0"
              aria-hidden
            >
              {gemInitial(activeClient.name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-sm font-semibold text-ag-text block truncate">
                {activeClient.name}
              </span>
              {activePeriod && (
                <span className="text-[10px] text-ag-muted block truncate">
                  {activePeriod.label}
                </span>
              )}
            </span>
          </>
        ) : (
          <span className="text-sm text-ag-muted flex-1">Selecione um cliente</span>
        )}
        <ChevronDown className="h-4 w-4 text-ag-muted shrink-0" aria-hidden />
      </button>
    </div>
  );
}

function ClientRow({
  client,
  subtitle,
  isActive,
  isLoading,
  disabled,
  onSelect,
  onOpenMenu,
}: {
  client: ClientMeta;
  subtitle?: string;
  isActive?: boolean;
  isLoading?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  onOpenMenu: (anchor: HTMLElement) => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onSelect}
        disabled={isActive || disabled}
        className={cn(
          "w-full flex items-center gap-2.5 rounded-lg pl-2 pr-9 py-2 text-left transition-colors min-w-0",
          isActive || disabled
            ? "cursor-default opacity-90"
            : "hover:bg-ag-surface-3 cursor-pointer"
        )}
      >
        <span
          className={cn(
            "h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
            isActive
              ? "bg-ag-accent text-ag-accent-fg ring-2 ring-ag-accent/30"
              : "bg-gradient-to-br from-ag-accent/80 to-ag-accent-strong text-ag-accent-fg"
          )}
          aria-hidden
        >
          {gemInitial(client.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-sm font-semibold text-ag-text block truncate">{client.name}</span>
          {isLoading ? (
            <span className="text-[10px] text-ag-accent block truncate">Carregando…</span>
          ) : (
            subtitle && (
              <span className="text-[10px] text-ag-muted block truncate">{subtitle}</span>
            )
          )}
        </span>
      </button>
      <button
        type="button"
        aria-label={`Opções de ${client.name}`}
        onClick={(e) => {
          e.stopPropagation();
          onOpenMenu(e.currentTarget);
        }}
        className="absolute right-1 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-lg text-ag-muted hover:text-ag-text hover:bg-ag-surface-2 cursor-pointer"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
    </div>
  );
}

function ClientHubCard({
  onClientCreated,
  onCollapse,
}: {
  onClientCreated?: (clientId: string) => void;
  onCollapse?: () => void;
}) {
  const {
    clients,
    activeClientId,
    activeClient,
    deleteClient,
    renameClient,
    hasActiveClient,
    isClientSwitching,
    clientSwitch,
    useApiStorage,
  } = useClientWorkspace();
  const permissions = usePermissionsOptional();
  const canCreateClients = !useApiStorage || (permissions?.canManageTeam() ?? false);
  const { navigateRoute } = useAppNavigation();
  const [modalOpen, setModalOpen] = useState(false);
  const [menuClientId, setMenuClientId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const otherClients = clients.filter((c) => c.id !== activeClientId);
  const menuClient = menuClientId ? clients.find((c) => c.id === menuClientId) : null;

  const openMenu = (clientId: string, anchor: HTMLElement) => {
    if (menuClientId === clientId) {
      setMenuClientId(null);
      setMenuAnchor(null);
      return;
    }
    setMenuClientId(clientId);
    setMenuAnchor(anchor);
  };

  const closeMenu = () => {
    setMenuClientId(null);
    setMenuAnchor(null);
  };

  const handleDelete = async (clientId: string, clientName: string) => {
    const msg =
      clients.length <= 1
        ? `Apagar o cliente «${clientName}»? Você ficará sem nenhum cliente cadastrado.`
        : `Excluir o cliente «${clientName}» e todos os dados dele? Esta ação não pode ser desfeita.`;
    if (!(await confirmDialog({ message: msg, variant: "danger", confirmLabel: "Excluir" }))) return;
    deleteClient(clientId);
    closeMenu();
  };

  if (clients.length === 0) {
    return (
      <>
        <div className="px-3 py-3 shrink-0">
          <p className="text-[11px] font-medium text-ag-muted mb-2">Nenhum cliente cadastrado</p>
          <button
            type="button"
            onClick={() => canCreateClients && setModalOpen(true)}
            disabled={!canCreateClients}
            className="w-full rounded-xl border border-dashed border-ag-border py-3 text-xs font-semibold text-ag-accent hover:bg-ag-accent/10 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {canCreateClients ? "Criar primeiro cliente" : "Sem clientes com acesso"}
          </button>
        </div>
        <NewClientModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onCreated={(clientId) => onClientCreated?.(clientId)}
        />
      </>
    );
  }

  return (
    <>
      <div className="px-3 py-3 shrink-0">
        {onCollapse && clients.length > 0 && (
          <div className="flex items-center justify-between gap-2 mb-2 px-0.5">
            <p className="text-[11px] font-medium text-ag-muted">Clientes</p>
            <button
              type="button"
              onClick={onCollapse}
              title="Recolher clientes"
              aria-label="Recolher clientes e planejamento"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold text-ag-muted hover:text-ag-text hover:bg-ag-surface-3 cursor-pointer transition-colors"
            >
              <ChevronUp className="h-3.5 w-3.5" />
              Recolher
            </button>
          </div>
        )}
        <div className="rounded-xl border border-ag-border/70 bg-ag-surface-2/60 overflow-hidden">
          {hasActiveClient && (
            <>
              <div className="px-1 pt-1 pb-0">
                <ClientRow
                  client={activeClient}
                  subtitle="Cliente ativo"
                  isActive
                  onOpenMenu={(anchor) => openMenu(activeClient.id, anchor)}
                />
              </div>

              <div className="border-t border-ag-border/50 px-3 py-3">
                <PlanningPeriodControls />
              </div>
            </>
          )}

          {otherClients.length > 0 && (
            <div className="border-t border-ag-border/50 px-1 py-2">
              <p className="text-[10px] font-medium text-ag-muted mb-1.5 px-2">Outros clientes</p>
              <ul
                className={cn(
                  "space-y-0.5",
                  otherClients.length > 3 && "max-h-44 overflow-y-auto ag-scrollbar-thin"
                )}
              >
                {otherClients.map((client) => (
                  <li key={client.id}>
                    <ClientRow
                      client={client}
                      isLoading={clientSwitch.targetClientId === client.id}
                      disabled={isClientSwitching}
                      onSelect={() => {
                        if (isClientSwitching) return;
                        void navigateRoute({ clientId: client.id });
                      }}
                      onOpenMenu={(anchor) => openMenu(client.id, anchor)}
                    />
                  </li>
                ))}
              </ul>
              {canCreateClients && (
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="w-full flex items-center justify-center gap-1.5 mt-2 mx-1 py-2 text-[11px] font-semibold text-ag-accent hover:bg-ag-accent/10 rounded-lg cursor-pointer border border-dashed border-ag-border/80"
              >
                <Plus className="h-3.5 w-3.5" />
                Novo cliente
              </button>
              )}
            </div>
          )}

          {otherClients.length === 0 && canCreateClients && (
            <div className="border-t border-ag-border/50 px-3 py-2">
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold text-ag-accent hover:bg-ag-accent/10 rounded-lg cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Novo cliente
              </button>
            </div>
          )}
        </div>
      </div>

      {menuClient && (
        <ClientOptionsMenu
          client={menuClient}
          anchorEl={menuAnchor}
          open={Boolean(menuClientId)}
          onClose={closeMenu}
          onRename={renameClient}
          onDelete={handleDelete}
          canManage={permissions?.canManageClients(menuClient.id) ?? !useApiStorage}
        />
      )}

      <NewClientModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(clientId) => onClientCreated?.(clientId)}
      />
    </>
  );
}

export function ClientHub({
  collapsed,
  onClientCreated,
  brandGemReady,
}: {
  collapsed: boolean;
  onClientCreated?: (clientId: string) => void;
  brandGemReady?: boolean;
}) {
  const { hasActiveClient, activeClient, workspace, activeClientId, clients } = useClientWorkspace();
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const [hubCollapsed, setHubCollapsed] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setHubCollapsed(loadClientHubCollapsed());
  }, []);

  useEffect(() => {
    setFlyoutOpen(false);
  }, [activeClientId]);

  const toggleHubCollapsed = () => {
    setHubCollapsed((c) => {
      const next = !c;
      saveClientHubCollapsed(next);
      return next;
    });
  };

  const expandHub = () => {
    setHubCollapsed(false);
    saveClientHubCollapsed(false);
  };

  const activePeriod =
    workspace.planningPeriods.find((p) => p.id === workspace.activePlanningPeriodId) ??
    workspace.planningPeriods[0];
  const periodHint =
    hasActiveClient && activePeriod
      ? shortPeriodLabel(activePeriod.label, activePeriod.startDate)
      : null;
  const avatarTitle =
    hasActiveClient && activePeriod
      ? `${activeClient.name} · ${activePeriod.label}`
      : hasActiveClient
        ? activeClient.name
        : "Clientes";

  if (!collapsed) {
    if (hubCollapsed && clients.length > 0) {
      return <ClientHubCompactBar onExpand={expandHub} />;
    }
    return (
      <ClientHubCard onClientCreated={onClientCreated} onCollapse={toggleHubCollapsed} />
    );
  }

  return (
    <div className="px-2 py-3 border-b border-ag-border flex flex-col items-center gap-1.5 shrink-0">
      <button
        ref={triggerRef}
        type="button"
        title={avatarTitle}
        aria-expanded={flyoutOpen}
        aria-haspopup="dialog"
        onClick={() => setFlyoutOpen((o) => !o)}
        className={cn(
          "h-9 w-9 rounded-full bg-gradient-to-br from-ag-accent to-ag-accent-strong flex items-center justify-center text-sm font-bold text-ag-accent-fg cursor-pointer ring-2 transition-all hover:ring-ag-accent/30",
          brandGemReady === false ? "ring-ag-warning/50" : "ring-transparent"
        )}
      >
        {hasActiveClient ? gemInitial(activeClient.name) : <Plus className="h-4 w-4" />}
      </button>
      {periodHint && (
        <span
          className="max-w-[2.75rem] text-[8px] font-semibold leading-tight text-center text-ag-muted truncate"
          title={activePeriod?.label}
        >
          {periodHint}
        </span>
      )}
      <FloatingPopover
        anchorRef={triggerRef}
        open={flyoutOpen}
        onClose={() => setFlyoutOpen(false)}
        placement="right-start"
        matchAnchorWidth={false}
        backdrop
        className="w-[17.5rem] max-h-[min(70vh,28rem)] overflow-y-auto ag-scrollbar-thin"
      >
        <ClientHubCard onClientCreated={onClientCreated} />
      </FloatingPopover>
    </div>
  );
}
