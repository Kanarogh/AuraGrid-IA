"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal, Plus, Trash2 } from "lucide-react";
import type { ClientMeta } from "../../../lib/clientWorkspace";
import { confirmDialog } from "../../../lib/confirmDialog";
import { promptDialog } from "../../../lib/promptDialog";

const MENU_WIDTH = 176;

export function ClientOptionsMenu({
  client,
  anchorEl,
  open,
  onClose,
  onRename,
  onDelete,
  canManage = true,
}: {
  client: ClientMeta;
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  onRename: (clientId: string, name: string) => void;
  onDelete: (clientId: string, name: string) => void | Promise<void>;
  canManage?: boolean;
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
        {canManage ? (
          <>
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
          </>
        ) : null}
      </div>
    </>,
    document.body
  );
}
