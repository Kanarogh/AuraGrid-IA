import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";
type Size = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  loading?: boolean;
  iconOnly?: boolean;
};

const variants: Record<Variant, string> = {
  primary: "ag-gradient-btn border border-transparent shadow-[var(--ag-shadow)]",
  secondary:
    "bg-ag-surface-2 text-ag-text border border-ag-border hover:bg-ag-surface-3 hover:border-ag-border/80",
  ghost:
    "bg-transparent text-ag-text border border-transparent hover:bg-ag-surface-2",
  danger:
    "bg-ag-danger/10 text-ag-danger border border-ag-danger/25 hover:bg-ag-danger/15",
  accent: "ag-gradient-btn border border-transparent shadow-[var(--ag-shadow)]",
};

const sizes: Record<Size, string> = {
  sm: "text-xs px-3 py-1.5 rounded-lg gap-1.5",
  md: "text-xs px-4 py-2.5 rounded-lg gap-2",
  lg: "text-sm px-5 py-3 rounded-xl gap-2",
};

const iconOnlySizes: Record<Size, string> = {
  sm: "p-1.5 rounded-lg",
  md: "p-2.5 rounded-lg",
  lg: "p-3 rounded-xl",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  children,
  disabled,
  loading,
  iconOnly,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "relative inline-flex items-center justify-center font-semibold transition-all duration-200 cursor-pointer ag-focus-ring disabled:opacity-45 disabled:cursor-not-allowed active:scale-[0.98]",
        variants[variant],
        iconOnly ? iconOnlySizes[size] : sizes[size],
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
