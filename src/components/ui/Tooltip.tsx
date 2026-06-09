import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

/** Lightweight CSS-only tooltip. Wraps any element; shows on hover/focus. */
export function Tooltip({
  label,
  children,
  side = "top",
  className,
}: {
  label: string;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}) {
  const sideClasses: Record<typeof side, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <span className={cn("group/tt relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-50 whitespace-nowrap rounded-lg border border-ag-border bg-ag-surface-1 px-2.5 py-1.5 text-[11px] font-medium text-ag-text shadow-[var(--ag-shadow)] opacity-0 transition-opacity duration-150 group-hover/tt:opacity-100 group-focus-within/tt:opacity-100",
          sideClasses[side]
        )}
      >
        {label}
      </span>
    </span>
  );
}
