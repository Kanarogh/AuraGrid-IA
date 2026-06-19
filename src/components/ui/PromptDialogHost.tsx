"use client";

import { useEffect, useState } from "react";
import {
  answerPrompt,
  subscribePrompt,
  type PromptDialogOptions,
} from "../../lib/promptDialog";
import { Input } from "./Input";
import { Modal, ModalActions } from "./Modal";

export function PromptDialogHost() {
  const [options, setOptions] = useState<(PromptDialogOptions & { open: boolean }) | null>(
    null
  );
  const [value, setValue] = useState("");

  useEffect(
    () =>
      subscribePrompt((pending) => {
        if (!pending) {
          setOptions(null);
          setValue("");
          return;
        }
        const { resolve: _resolve, defaultValue = "", ...opts } = pending;
        setValue(defaultValue);
        setOptions({ ...opts, open: true });
      }),
    []
  );

  if (!options?.open) return null;

  const {
    title = "Informe o valor",
    message,
    placeholder,
    confirmLabel = "Confirmar",
    cancelLabel = "Cancelar",
  } = options;

  const submit = () => {
    const trimmed = value.trim();
    answerPrompt(trimmed || null);
  };

  return (
    <Modal
      open
      onClose={() => answerPrompt(null)}
      title={title}
      size="sm"
      footer={
        <ModalActions
          cancelLabel={cancelLabel}
          confirmLabel={confirmLabel}
          onCancel={() => answerPrompt(null)}
          onConfirm={submit}
        />
      }
    >
      <div className="space-y-3">
        {message ? (
          <p className="text-sm leading-relaxed text-ag-muted whitespace-pre-line">{message}</p>
        ) : null}
        <Input
          autoFocus
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
        />
      </div>
    </Modal>
  );
}
