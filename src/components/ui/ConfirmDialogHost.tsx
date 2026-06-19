"use client";

import { useEffect, useState } from "react";
import { answerConfirm, subscribeConfirm, type ConfirmDialogOptions } from "../../lib/confirmDialog";
import { Modal, ModalActions } from "./Modal";

export function ConfirmDialogHost() {
  const [options, setOptions] = useState<(ConfirmDialogOptions & { open: boolean }) | null>(
    null
  );

  useEffect(
    () =>
      subscribeConfirm((pending) => {
        if (!pending) {
          setOptions(null);
          return;
        }
        const { resolve: _resolve, ...opts } = pending;
        setOptions({ ...opts, open: true });
      }),
    []
  );

  if (!options?.open) return null;

  const {
    title = "Confirmar",
    message,
    confirmLabel = "Confirmar",
    cancelLabel = "Cancelar",
    variant = "primary",
  } = options;

  return (
    <Modal
      open
      onClose={() => answerConfirm(false)}
      title={title}
      size="sm"
      footer={
        <ModalActions
          cancelLabel={cancelLabel}
          confirmLabel={confirmLabel}
          confirmVariant={variant === "danger" ? "danger" : "primary"}
          onCancel={() => answerConfirm(false)}
          onConfirm={() => answerConfirm(true)}
        />
      }
    >
      <p className="text-sm leading-relaxed text-ag-muted whitespace-pre-line">{message}</p>
    </Modal>
  );
}
