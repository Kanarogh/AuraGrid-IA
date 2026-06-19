export type ConfirmDialogOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "primary" | "danger";
};

type PendingConfirm = ConfirmDialogOptions & {
  resolve: (value: boolean) => void;
};

type Listener = (state: PendingConfirm | null) => void;

let pending: PendingConfirm | null = null;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((listener) => listener(pending));
}

export function subscribeConfirm(listener: Listener) {
  listeners.add(listener);
  listener(pending);
  return () => {
    listeners.delete(listener);
  };
}

export function getPendingConfirm() {
  return pending;
}

export function confirmDialog(
  options: ConfirmDialogOptions | string
): Promise<boolean> {
  const opts: ConfirmDialogOptions =
    typeof options === "string" ? { message: options } : options;

  if (pending) {
    pending.resolve(false);
    pending = null;
  }

  return new Promise<boolean>((resolve) => {
    pending = { ...opts, resolve };
    emit();
  });
}

export function answerConfirm(confirmed: boolean) {
  if (!pending) return;
  pending.resolve(confirmed);
  pending = null;
  emit();
}
