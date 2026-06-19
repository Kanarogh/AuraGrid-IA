"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "../../lib/cn";
import { dismiss, subscribe, type ToastItem, type ToastType } from "../../lib/toast";

const toneConfig: Record<
  ToastType,
  { icon: typeof Info; className: string; bar: string }
> = {
  success: {
    icon: CheckCircle2,
    className: "border-ag-success/30 bg-ag-surface-1/95 text-ag-text",
    bar: "bg-ag-success",
  },
  error: {
    icon: AlertCircle,
    className: "border-ag-danger/35 bg-ag-surface-1/95 text-ag-text",
    bar: "bg-ag-danger",
  },
  warning: {
    icon: AlertCircle,
    className: "border-ag-warning/35 bg-ag-surface-1/95 text-ag-text",
    bar: "bg-ag-warning",
  },
  info: {
    icon: Info,
    className: "border-ag-accent/30 bg-ag-surface-1/95 text-ag-text",
    bar: "bg-ag-accent",
  },
};

function ToastCard({ item }: { item: ToastItem }) {
  const { icon: Icon, className, bar } = toneConfig[item.type];

  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto relative overflow-hidden rounded-2xl border shadow-[var(--ag-shadow-lg)] backdrop-blur-md animate-ag-toast-in",
        className
      )}
    >
      <div className={cn("absolute left-0 top-0 h-full w-1", bar)} />
      <div className="flex items-start gap-3 py-3.5 pl-4 pr-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ag-accent" />
        <p className="min-w-0 flex-1 text-sm leading-relaxed whitespace-pre-line text-ag-text">
          {item.message}
        </p>
        <button
          type="button"
          onClick={() => dismiss(item.id)}
          className="shrink-0 rounded-lg p-1 text-ag-muted transition-colors hover:bg-ag-surface-2 hover:text-ag-text ag-focus-ring"
          aria-label="Fechar notificação"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => subscribe(setItems), []);

  if (items.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(100vw-2rem,24rem)] flex-col gap-2.5"
      aria-live="polite"
      aria-relevant="additions"
    >
      {items.map((item) => (
        <ToastCard key={item.id} item={item} />
      ))}
    </div>
  );
}
