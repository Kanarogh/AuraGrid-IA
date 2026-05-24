import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/cn";
import { Button } from "./Button";

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ag-bg/80 backdrop-blur-sm animate-ag-fade-in"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className={cn(
          "w-full rounded-2xl border border-ag-border bg-ag-surface-1 shadow-[var(--ag-shadow-lg)] animate-ag-scale-in flex flex-col max-h-[90vh]",
          size === "md" ? "max-w-md" : "max-w-2xl"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-ag-border shrink-0">
          <h3 className="font-display text-xl font-semibold text-ag-text">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-ag-muted hover:text-ag-text hover:bg-ag-surface-2 transition-colors ag-focus-ring"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-ag-border flex justify-end gap-2 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function ModalActions({
  onCancel,
  onConfirm,
  confirmLabel = "Salvar",
  cancelLabel = "Cancelar",
  confirmVariant = "primary" as const,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: "primary" | "accent";
}) {
  return (
    <>
      <Button variant="secondary" size="sm" onClick={onCancel}>
        {cancelLabel}
      </Button>
      <Button variant={confirmVariant} size="sm" onClick={onConfirm}>
        {confirmLabel}
      </Button>
    </>
  );
}
