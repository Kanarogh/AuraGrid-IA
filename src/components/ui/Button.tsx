import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";
type Size = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
};

const variants: Record<Variant, string> = {
  primary:
    "bg-ag-cta text-ag-cta-fg hover:opacity-90 border border-transparent shadow-sm",
  secondary:
    "bg-ag-surface-2 text-ag-text border border-ag-border hover:bg-ag-surface-3",
  ghost:
    "bg-transparent text-ag-text border border-transparent hover:bg-ag-surface-2",
  danger:
    "bg-ag-danger/10 text-ag-danger border border-ag-danger/25 hover:bg-ag-danger/15",
  accent:
    "bg-ag-accent text-white border border-transparent hover:opacity-90 shadow-sm",
};

const sizes: Record<Size, string> = {
  sm: "text-xs px-3 py-1.5 rounded-lg gap-1.5",
  md: "text-xs px-4 py-2.5 rounded-xl gap-2",
  lg: "text-sm px-5 py-3 rounded-xl gap-2",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center font-semibold transition-all duration-200 cursor-pointer ag-focus-ring disabled:opacity-45 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
