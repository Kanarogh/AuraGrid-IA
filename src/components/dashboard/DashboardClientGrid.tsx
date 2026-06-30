import { Plus } from "lucide-react";
import { gemInitial } from "../../lib/brandGem";
import type { ClientMeta } from "../../lib/clientWorkspace";
import { cn } from "../../lib/cn";

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes} min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d atrás`;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function DashboardClientGrid({
  clients,
  activeClientId,
  switchingClientId,
  clientSwitchDisabled,
  onSelectClient,
  onCreateClient,
  showCreateButton = true,
}: {
  clients: ClientMeta[];
  activeClientId: string;
  switchingClientId?: string | null;
  clientSwitchDisabled?: boolean;
  onSelectClient: (clientId: string) => void;
  onCreateClient: () => void;
  showCreateButton?: boolean;
}) {
  return (
    <section className="space-y-3 animate-ag-fade-in">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-ag-accent">
            Clientes
          </p>
          <h2 className="font-display text-lg font-semibold text-ag-text mt-1">Seus clientes</h2>
        </div>
        {showCreateButton !== false && (
        <button
          type="button"
          onClick={onCreateClient}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ag-accent hover:underline cursor-pointer shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          Novo
        </button>
        )}
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 ag-scrollbar-thin snap-x snap-mandatory sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:overflow-visible sm:pb-0">
        {clients.map((client) => {
          const isActive = client.id === activeClientId;
          const isSwitchingTarget = switchingClientId === client.id;
          return (
            <button
              key={client.id}
              type="button"
              disabled={clientSwitchDisabled && !isActive}
              onClick={() => {
                if (clientSwitchDisabled || isActive) return;
                onSelectClient(client.id);
              }}
              className={cn(
                "snap-start shrink-0 w-[min(100%,16rem)] sm:w-auto text-left rounded-xl border bg-ag-surface-1 p-4",
                "transition-all ag-focus-ring hover:shadow-[var(--ag-shadow-lg)]",
                clientSwitchDisabled && !isActive && "opacity-60 cursor-not-allowed",
                !clientSwitchDisabled && "cursor-pointer",
                isActive
                  ? "border-ag-accent/40 ring-2 ring-ag-accent/20 shadow-[var(--ag-shadow)]"
                  : "border-ag-border/60 hover:border-ag-accent/30"
              )}
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                    isActive
                      ? "bg-ag-accent text-ag-accent-fg"
                      : "bg-gradient-to-br from-ag-accent/80 to-ag-accent-strong text-ag-accent-fg"
                  )}
                >
                  {gemInitial(client.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ag-text truncate">{client.name}</p>
                  {client.instagramHandle ? (
                    <p className="text-xs text-ag-muted truncate">@{client.instagramHandle}</p>
                  ) : (
                    <p className="text-xs text-ag-muted truncate">Sem perfil social configurado</p>
                  )}
                </div>
              </div>
              <p className="mt-3 text-[10px] font-mono uppercase tracking-wider text-ag-muted">
                {isSwitchingTarget
                  ? "Carregando…"
                  : `Atualizado ${formatRelativeTime(client.updatedAt)}`}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
