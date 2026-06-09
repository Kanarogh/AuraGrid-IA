import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Tooltip } from "./Tooltip";

type Variant = "ghost" | "surface" | "accent" | "danger";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  ghost: "text-ag-muted hover:text-ag-text hover:bg-ag-surface-2",
  surface: "bg-ag-surface-2 text-ag-text border border-ag-border hover:bg-ag-surface-3",
  accent: "bg-ag-accent text-ag-accent-fg hover:bg-ag-accent-strong shadow-sm",
  danger: "text-ag-danger hover:bg-ag-danger/10",
};

const sizes: Record<Size, string> = {
  sm: "p-1.5 rounded-lg",
  md: "p-2 rounded-lg",
};

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  label: string;
  tooltipSide?: "top" | "bottom" | "left" | "right";
};

export function IconButton({
  children,
  variant = "ghost",
  size = "md",
  label,
  tooltipSide = "top",
  className,
  ...props
}: IconButtonProps) {
  const btn = (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center justify-center transition-all duration-200 cursor-pointer ag-focus-ring disabled:opacity-45 disabled:cursor-not-allowed active:scale-95",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
  return (
    <Tooltip label={label} side={tooltipSide}>
      {btn}
    </Tooltip>
  );
}
