import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "../../lib/cn";

type AlertTone = "info" | "warning" | "success" | "danger";

const config: Record<
  AlertTone,
  { icon: typeof Info; className: string; iconClass: string }
> = {
  info: {
    icon: Info,
    className: "bg-ag-accent-soft border-ag-accent/25 text-ag-text",
    iconClass: "text-ag-accent",
  },
  warning: {
    icon: AlertCircle,
    className: "bg-ag-warning/10 border-ag-warning/30 text-ag-text",
    iconClass: "text-ag-warning",
  },
  success: {
    icon: CheckCircle2,
    className: "bg-ag-success/10 border-ag-success/30 text-ag-text",
    iconClass: "text-ag-success",
  },
  danger: {
    icon: AlertCircle,
    className: "bg-ag-danger/10 border-ag-danger/30 text-ag-text",
    iconClass: "text-ag-danger",
  },
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: AlertTone;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const { icon: Icon, className: toneClass, iconClass } = config[tone];
  return (
    <div
      className={cn(
        "flex gap-3 p-4 rounded-xl border text-sm animate-ag-fade-in",
        toneClass,
        className
      )}
    >
      <Icon className={cn("h-5 w-5 shrink-0 mt-0.5", iconClass)} />
      <div className="min-w-0">
        {title && <p className="font-semibold text-ag-text mb-1">{title}</p>}
        <div className="text-ag-muted text-xs leading-relaxed">{children}</div>
      </div>
    </div>
  );
}
