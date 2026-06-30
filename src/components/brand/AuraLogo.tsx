import { cn } from "../../lib/cn";
import { AuraLogoIcon } from "./AuraLogoIcon";

export function AuraLogo({
  variant = "horizontal",
  iconSize = 36,
  className,
  showTagline = false,
  tagline,
}: {
  variant?: "horizontal" | "stacked" | "icon";
  iconSize?: number;
  className?: string;
  showTagline?: boolean;
  tagline?: string;
}) {
  if (variant === "icon") {
    return <AuraLogoIcon size={iconSize} className={className} />;
  }

  const stacked = variant === "stacked";

  return (
    <div
      className={cn(
        "flex items-center gap-3",
        stacked && "flex-col items-center text-center gap-2",
        className
      )}
    >
      <AuraLogoIcon size={iconSize} />
      <div className={cn("min-w-0", stacked && "flex flex-col items-center")}>
        <span className="ag-brand-wordmark text-xl text-ag-text leading-none block">aura</span>
        <span className="ag-brand-studio ag-gradient-text block mt-0.5">STUDIO</span>
        {showTagline && tagline && (
          <p className="text-xs text-ag-muted mt-2 max-w-xs leading-relaxed">{tagline}</p>
        )}
      </div>
    </div>
  );
}
