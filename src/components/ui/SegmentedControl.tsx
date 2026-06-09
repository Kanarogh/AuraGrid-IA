import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";

export interface SegmentOption<T extends string> {
  id: T;
  label: string;
  icon?: LucideIcon;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  className,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (id: T) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex items-center gap-1 rounded-xl border border-ag-border bg-ag-surface-2 p-1",
        className
      )}
    >
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg font-semibold transition-all duration-200 cursor-pointer ag-focus-ring",
              size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3.5 py-1.5 text-xs",
              active
                ? "bg-ag-surface-1 text-ag-text shadow-sm"
                : "text-ag-muted hover:text-ag-text"
            )}
          >
            {Icon && <Icon className={cn("h-3.5 w-3.5", active && "text-ag-accent")} />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
