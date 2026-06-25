"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, Plus } from "lucide-react";
import { gemInitial } from "../../../lib/brandGem";
import { useClientWorkspace } from "../../../context/ClientWorkspaceContext";
import { cn } from "../../../lib/cn";
import { confirmDialog } from "../../../lib/confirmDialog";
import { useAppNavigation } from "../../../lib/appRouting";
import { NewClientModal } from "../../clients/NewClientModal";
import { FloatingPopover } from "../../ui/FloatingPopover";
import { ClientOptionsMenu } from "./ClientOptionsMenu";
import { PlanningPeriodControls } from "./PlanningPeriodControls";
import { shortPeriodLabel } from "./planningPeriodUtils";

const MAX_VISIBLE_AVATARS = 4;

function ClientAvatarButton({
  name,
  isActive,
  size = "md",
  onClick,
  title,
}: {
  name: string;
  isActive?: boolean;
  size?: "sm" | "md" | "lg";
  onClick: () => void;
  title?: string;
}) {
  const sizeClass =
    size === "lg" ? "h-10 w-10 text-sm" : size === "md" ? "h-8 w-8 text-xs" : "h-7 w-7 text-[10px]";

  return (
    <button
      type="button"
      title={title ?? name}
      aria-label={title ?? name}
      onClick={onClick}
      className={cn(
        "rounded-full flex items-center justify-center font-bold shrink-0 transition-all cursor-pointer",
        sizeClass,
        isActive
          ? "bg-ag-accent text-ag-accent-fg ring-2 ring-ag-accent/30"
          : "bg-gradient-to-br from-ag-accent/80 to-ag-accent-strong text-ag-accent-fg hover:ring-2 hover:ring-ag-accent/20"
      )}
    >
      {gemInitial(name)}
    </button>
  );
}

function ClientHubCard({ onClientCreated }: { onClientCreated?: (clientId: string) => void }) {
  const {
    clients,
    activeClientId,
    activeClient,
    deleteClient,
    renameClient,
    hasActiveClient,
  } = useClientWorkspace();
  const { navigateRoute } = useAppNavigation();
  const [modalOpen, setModalOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLButtonElement>(null);

  const otherClients = clients.filter((c) => c.id !== activeClientId);
  const visibleOthers = otherClients.slice(0, MAX_VISIBLE_AVATARS);
  const overflowCount = otherClients.length - MAX_VISIBLE_AVATARS;

  const handleDelete = async (clientId: string, clientName: string) => {
    const msg =
      clients.length <= 1
        ? `Apagar o cliente «${clientName}»? Você ficará sem nenhum cliente cadastrado.`
        : `Excluir o cliente «${clientName}» e todos os dados dele? Esta ação não pode ser desfeita.`;
    if (!(await confirmDialog({ message: msg, variant: "danger", confirmLabel: "Excluir" }))) return;
    deleteClient(clientId);
    setMenuOpen(false);
  };

  if (clients.length === 0) {
    return (
      <>
        <div className="px-3 py-3 shrink-0">
          <p className="text-[11px] font-medium text-ag-muted mb-2">Nenhum cliente cadastrado</p>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="w-full rounded-2xl border border-dashed border-ag-border py-3 text-xs font-semibold text-ag-accent hover:bg-ag-accent/10 cursor-pointer transition-colors"
          >
            Criar primeiro cliente
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
        <div className="rounded-2xl border border-ag-border/70 bg-ag-surface-2/60 overflow-hidden">
          {hasActiveClient && (
            <>
              <div className="flex items-center gap-2.5 px-3 pt-3 pb-2">
                <span
                  className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                    "bg-ag-accent text-ag-accent-fg ring-2 ring-ag-accent/30"
                  )}
                  aria-hidden
                >
                  {gemInitial(activeClient.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ag-text truncate">{activeClient.name}</p>
                  <p className="text-[10px] text-ag-muted">Cliente ativo</p>
                </div>
                <button
                  type="button"
                  aria-label="Opções do cliente"
                  aria-expanded={menuOpen}
                  onClick={(e) => {
                    setMenuAnchor(e.currentTarget);
                    setMenuOpen((o) => !o);
                  }}
                  className="p-1.5 rounded-lg text-ag-muted hover:text-ag-text hover:bg-ag-surface-3 cursor-pointer shrink-0"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>

              <div className="border-t border-ag-border/50 px-3 py-3">
                <PlanningPeriodControls />
              </div>
            </>
          )}

          {otherClients.length > 0 && (
            <div className="border-t border-ag-border/50 px-3 py-2.5">
              <p className="text-[10px] font-medium text-ag-muted mb-2">Outros clientes</p>
              <div className="flex flex-wrap items-center gap-1.5">
                {visibleOthers.map((client) => (
                  <ClientAvatarButton
                    key={client.id}
                    name={client.name}
                    size="sm"
                    title={`Trocar para ${client.name}`}
                    onClick={() => void navigateRoute({ clientId: client.id })}
                  />
                ))}
                {overflowCount > 0 && (
                  <>
                    <button
                      ref={overflowRef}
                      type="button"
                      aria-expanded={overflowOpen}
                      onClick={() => setOverflowOpen((o) => !o)}
                      className="h-7 min-w-[1.75rem] px-1.5 rounded-full bg-ag-surface-3 text-[10px] font-bold text-ag-muted hover:text-ag-text hover:bg-ag-surface-2 cursor-pointer"
                    >
                      +{overflowCount}
                    </button>
                    <FloatingPopover
                      anchorRef={overflowRef}
                      open={overflowOpen}
                      onClose={() => setOverflowOpen(false)}
                      placement="bottom-start"
                      matchAnchorWidth={false}
                      backdrop
                      className="w-52 max-h-48 overflow-y-auto ag-scrollbar-thin py-1"
                    >
                      {otherClients.slice(MAX_VISIBLE_AVATARS).map((client) => (
                        <button
                          key={client.id}
                          type="button"
                          onClick={() => {
                            void navigateRoute({ clientId: client.id });
                            setOverflowOpen(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-ag-surface-2 cursor-pointer"
                        >
                          <span className="h-7 w-7 rounded-full bg-gradient-to-br from-ag-accent/80 to-ag-accent-strong text-ag-accent-fg text-[10px] font-bold flex items-center justify-center shrink-0">
                            {gemInitial(client.name)}
                          </span>
                          <span className="truncate">{client.name}</span>
                        </button>
                      ))}
                    </FloatingPopover>
                  </>
                )}
                <button
                  type="button"
                  title="Novo cliente"
                  aria-label="Novo cliente"
                  onClick={() => setModalOpen(true)}
                  className="h-7 w-7 rounded-full border border-dashed border-ag-border flex items-center justify-center text-ag-accent hover:bg-ag-accent/10 cursor-pointer shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {otherClients.length === 0 && (
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

      {hasActiveClient && menuOpen && (
        <ClientOptionsMenu
          client={activeClient}
          anchorEl={menuAnchor}
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          onRename={renameClient}
          onDelete={handleDelete}
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
  const { hasActiveClient, activeClient, workspace, activeClientId } = useClientWorkspace();
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setFlyoutOpen(false);
  }, [activeClientId]);

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
    return <ClientHubCard onClientCreated={onClientCreated} />;
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
          brandGemReady === false ? "ring-amber-500/50" : "ring-transparent"
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
