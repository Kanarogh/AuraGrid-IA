export type ToastType = "success" | "error" | "warning" | "info";

export type ToastItem = {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
};

type Listener = (toasts: ToastItem[]) => void;

const MAX_TOASTS = 5;
const DEFAULT_DURATION: Record<ToastType, number> = {
  success: 4500,
  info: 5000,
  warning: 6500,
  error: 8000,
};

let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function emit() {
  const snapshot = [...toasts];
  listeners.forEach((listener) => listener(snapshot));
}

function scheduleDismiss(id: string, duration: number) {
  const existing = timers.get(id);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => dismiss(id), duration);
  timers.set(id, timer);
}

function push(type: ToastType, message: string, duration?: number) {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `toast_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const resolvedDuration = duration ?? DEFAULT_DURATION[type];
  const item: ToastItem = { id, type, message, duration: resolvedDuration };

  toasts = [...toasts, item].slice(-MAX_TOASTS);
  emit();
  scheduleDismiss(id, resolvedDuration);
  return id;
}

export function dismiss(id: string) {
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
  if (!toasts.some((t) => t.id === id)) return;
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function subscribe(listener: Listener) {
  listeners.add(listener);
  listener([...toasts]);
  return () => {
    listeners.delete(listener);
  };
}

export const toast = {
  success: (message: string, duration?: number) => push("success", message, duration),
  error: (message: string, duration?: number) => push("error", message, duration),
  warning: (message: string, duration?: number) => push("warning", message, duration),
  info: (message: string, duration?: number) => push("info", message, duration),
};
