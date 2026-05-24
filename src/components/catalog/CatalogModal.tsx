import type { DragEvent } from "react";
import { Upload } from "lucide-react";
import { Modal, ModalActions } from "../ui/Modal";
import { FieldLabel, Input } from "../ui/Input";
import { cn } from "../../lib/cn";

export function CatalogModal({
  open,
  onClose,
  label,
  onLabelChange,
  image,
  dragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onPickFile,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  onLabelChange: (v: string) => void;
  image: string | null;
  dragOver: boolean;
  onDragOver: (e: DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent) => void;
  onPickFile: () => void;
  onSave: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nova referência de acervo"
      footer={
        <ModalActions
          onCancel={onClose}
          onConfirm={onSave}
          confirmLabel="Salvar look"
          confirmVariant="accent"
        />
      }
    >
      <div className="space-y-4">
        <div>
          <FieldLabel>Foto do look</FieldLabel>
          <div
            onClick={onPickFile}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={cn(
              "border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer min-h-[140px] transition-colors",
              dragOver
                ? "border-ag-accent bg-ag-accent-soft"
                : "border-ag-border bg-ag-surface-2 hover:border-ag-muted"
            )}
          >
            {image ? (
              <img
                src={image}
                alt="Preview"
                referrerPolicy="no-referrer"
                className="max-h-24 object-contain rounded-lg border border-ag-border"
              />
            ) : (
              <>
                <Upload className="h-6 w-6 text-ag-muted mb-2" />
                <span className="text-sm font-medium text-ag-text">
                  Selecione ou arraste a foto
                </span>
                <span className="text-xs text-ag-muted mt-1">PNG, JPG</span>
              </>
            )}
          </div>
        </div>
        <div>
          <FieldLabel>Código de referência</FieldLabel>
          <Input
            value={label}
            onChange={(e) => onLabelChange(e.target.value)}
            placeholder="Ex: 9146 Pink"
          />
        </div>
      </div>
    </Modal>
  );
}
