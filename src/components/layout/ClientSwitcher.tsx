import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { gemInitial } from "../../lib/brandGem";
import { useClientWorkspace } from "../../context/ClientWorkspaceContext";
import type { ClientMeta } from "../../lib/clientWorkspace";
import { cn } from "../../lib/cn";
import { confirmDialog } from "../../lib/confirmDialog";
import { promptDialog } from "../../lib/promptDialog";
import { NewClientModal } from "../clients/NewClientModal";

const MENU_WIDTH = 176;

function ClientOptionsMenu({
  client,
  anchorEl,
  open,
  onClose,
  onRename,
  onDelete,
}: {
  client: ClientMeta;
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  onRename: (clientId: string, name: string) => void;
  onDelete: (clientId: string, name: string) => void | Promise<void>;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!open || !anchorEl) return;

    const updatePosition = () => {
      const rect = anchorEl.getBoundingClientRect();
      const menuHeight = menuRef.current?.offsetHeight ?? 72;
      const gap = 4;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < menuHeight + gap + 8;

      setPosition({
        top: openUp ? rect.top - menuHeight - gap : rect.bottom + gap,
        left: Math.min(
          Math.max(8, rect.right - MENU_WIDTH),
          window.innerWidth - MENU_WIDTH - 8
        ),
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, anchorEl, client.id]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || !anchorEl) return null;

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Fechar menu"
        className="fixed inset-0 z-[60] cursor-default"
        onClick={onClose}
      />
      <div
        ref={menuRef}
        role="menu"
        className="fixed z-[70] w-44 rounded-lg border border-ag-border bg-ag-surface-1 shadow-lg py-1 text-xs"
        style={{ top: position.top, left: position.left }}
      >
        <button
          type="button"
          role="menuitem"
          className="w-full px-3 py-2 text-left hover:bg-ag-surface-2 cursor-pointer"
          onClick={() => {
            void (async () => {
              const next = await promptDialog({
                title: "Renomear cliente",
                defaultValue: client.name,
                placeholder: "Nome do cliente",
                confirmLabel: "Salvar",
              });
              if (next) onRename(client.id, next);
              onClose();
            })();
          }}
        >
          Renomear
        </button>
        <button
          type="button"
          role="menuitem"
          className="w-full px-3 py-2 text-left text-ag-danger hover:bg-ag-danger/10 cursor-pointer flex items-center gap-1.5"
          onClick={() => {
            void onDelete(client.id, client.name);
            onClose();
          }}
        >
          <Trash2 className="h-3 w-3" />
          Excluir
        </button>
      </div>
    </>,
    document.body
  );
}

export function ClientSwitcher({
  collapsed,
  onClientCreated,
}: {
  collapsed: boolean;
  onClientCreated?: () => void;
}) {
  const {
    clients,
    activeClientId,
    activeClient,
    switchClient,
    deleteClient,
    renameClient,
    hasActiveClient,
  } = useClientWorkspace();
  const [modalOpen, setModalOpen] = useState(false);
  const [menuClientId, setMenuClientId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const menuClient = menuClientId ? clients.find((c) => c.id === menuClientId) : null;

  const closeMenu = () => {
    setMenuClientId(null);
    setMenuAnchor(null);
  };

  const openMenu = (clientId: string, anchor: HTMLElement) => {
    if (menuClientId === clientId) {
      closeMenu();
      return;
    }
    setMenuClientId(clientId);
    setMenuAnchor(anchor);
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

  if (collapsed) {
    return (
      <>
        <div className="px-2 py-3 border-b border-ag-border flex flex-col items-center gap-2 shrink-0">
          <button
            type="button"
            title={hasActiveClient ? activeClient.name : "Novo cliente"}
            className="h-9 w-9 rounded-full bg-gradient-to-br from-ag-accent to-ag-accent-strong flex items-center justify-center text-sm font-bold text-ag-accent-fg cursor-pointer"
            onClick={() => setModalOpen(true)}
          >
            {hasActiveClient ? gemInitial(activeClient.name) : <Plus className="h-4 w-4" />}
          </button>
        </div>
        <NewClientModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onCreated={() => onClientCreated?.()}
        />
      </>
    );
  }

  if (clients.length === 0) {
    return (
      <>
        <div className="shrink-0 px-3 py-3 border-b border-ag-border space-y-2">
          <div className="flex items-center justify-between gap-2 px-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-ag-muted">Clientes</p>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-ag-accent hover:underline cursor-pointer shrink-0"
            >
              <Plus className="h-3 w-3" />
              Novo
            </button>
          </div>
          <p className="text-xs text-ag-muted px-1">Nenhum cliente cadastrado.</p>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="w-full rounded-lg border border-dashed border-ag-border py-2.5 text-xs font-medium text-ag-accent hover:bg-ag-accent/10 cursor-pointer"
          >
            Criar primeiro cliente
          </button>
        </div>
        <NewClientModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onCreated={() => onClientCreated?.()}
        />
      </>
    );
  }

  return (
    <>
      <div className="shrink-0 px-3 py-3 border-b border-ag-border space-y-2 overflow-visible">
        <div className="flex items-center justify-between gap-2 px-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-ag-muted">Clientes</p>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-ag-accent hover:underline cursor-pointer shrink-0"
          >
            <Plus className="h-3 w-3" />
            Novo
          </button>
        </div>
        <ul
          className={cn(
            "space-y-0.5",
            clients.length > 4 && "max-h-40 overflow-y-auto overflow-x-hidden ag-scrollbar-thin"
          )}
        >
          {clients.map((client) => {
            const isActive = client.id === activeClientId;
            const menuOpen = menuClientId === client.id;
            return (
              <li key={client.id} className="relative">
                <button
                  type="button"
                  onClick={() => switchClient(client.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 rounded-lg pl-2 pr-9 py-2 text-left transition-colors cursor-pointer min-w-0",
                    isActive
                      ? "bg-ag-accent/15 text-ag-accent ring-1 ring-ag-accent/30"
                      : "text-ag-text hover:bg-ag-surface-3"
                  )}
                >
                  <span
                    className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                      isActive
                        ? "bg-ag-accent text-ag-accent-fg"
                        : "bg-gradient-to-br from-ag-accent/80 to-ag-accent-strong text-ag-accent-fg"
                    )}
                  >
                    {gemInitial(client.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-sm font-medium block truncate">{client.name}</span>
                    <span className="text-[10px] text-ag-muted font-mono truncate block">
                      {client.id}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  aria-label="Opções do cliente"
                  aria-expanded={menuOpen}
                  onClick={(e) => {
                    e.stopPropagation();
                    openMenu(client.id, e.currentTarget);
                  }}
                  className={cn(
                    "absolute right-1 top-1/2 -translate-y-1/2 z-10 p-1 rounded-md transition-opacity cursor-pointer",
                    "text-ag-muted hover:text-ag-text hover:bg-ag-surface-2",
                    menuOpen ? "opacity-100 bg-ag-surface-2" : "opacity-70 hover:opacity-100"
                  )}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {menuClient && (
        <ClientOptionsMenu
          client={menuClient}
          anchorEl={menuAnchor}
          open={Boolean(menuClientId)}
          onClose={closeMenu}
          onRename={renameClient}
          onDelete={handleDelete}
        />
      )}

      <NewClientModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => onClientCreated?.()}
      />
    </>
  );
}
