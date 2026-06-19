export type PromptDialogOptions = {
  title?: string;
  message?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

type PendingPrompt = PromptDialogOptions & {
  resolve: (value: string | null) => void;
};

type Listener = (state: PendingPrompt | null) => void;

let pending: PendingPrompt | null = null;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((listener) => listener(pending));
}

export function subscribePrompt(listener: Listener) {
  listeners.add(listener);
  listener(pending);
  return () => {
    listeners.delete(listener);
  };
}

export function promptDialog(options: PromptDialogOptions): Promise<string | null> {
  if (pending) {
    pending.resolve(null);
    pending = null;
  }

  return new Promise<string | null>((resolve) => {
    pending = { ...options, resolve };
    emit();
  });
}

export function answerPrompt(value: string | null) {
  if (!pending) return;
  pending.resolve(value);
  pending = null;
  emit();
}
