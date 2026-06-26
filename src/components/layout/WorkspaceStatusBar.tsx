import { Sparkles } from "lucide-react";
import { Badge } from "../ui/Badge";
import { cn } from "../../lib/cn";
import type { AppSection } from "../../lib/sectionMeta";

export function WorkspaceStatusBar({
  brandGemReady,
  brandGemMissingCount = 0,
  collapsed,
  variant = "sidebar",
  onOpenSettings,
}: {
  brandGemReady?: boolean;
  brandGemMissingCount?: number;
  collapsed?: boolean;
  variant?: "sidebar" | "topbar";
  onOpenSettings: (section: AppSection) => void;
}) {
  const gemLabel =
    brandGemReady === undefined
      ? null
      : brandGemReady
        ? "Gem pronto"
        : brandGemMissingCount > 0
          ? `Gem — ${brandGemMissingCount} pendente${brandGemMissingCount !== 1 ? "s" : ""}`
          : "Gem incompleto";

  if (!gemLabel) return null;

  if (variant === "topbar") {
    return (
      <button
        type="button"
        title={gemLabel}
        onClick={() => !brandGemReady && onOpenSettings("settings")}
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-ag-border bg-ag-surface-1 shrink-0",
          brandGemReady ? "text-ag-success" : "text-ag-warning",
          !brandGemReady && "cursor-pointer hover:bg-ag-surface-2",
          brandGemReady && "cursor-default"
        )}
      >
        <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="hidden sm:inline uppercase tracking-wide">{gemLabel}</span>
        <span className="sm:hidden uppercase tracking-wide">Gem</span>
      </button>
    );
  }

  if (collapsed) {
    return (
      <button
        type="button"
        title={gemLabel}
        onClick={() => !brandGemReady && onOpenSettings("settings")}
        className={cn(!brandGemReady && "cursor-pointer hover:opacity-90")}
      >
        <Badge tone={brandGemReady ? "success" : "warning"} dot className="p-2 rounded-lg">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
        </Badge>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => !brandGemReady && onOpenSettings("settings")}
      className={cn(
        "w-full",
        !brandGemReady ? "cursor-pointer hover:opacity-90" : "cursor-default"
      )}
    >
      <Badge
        tone={brandGemReady ? "success" : "warning"}
        dot
        className="w-full justify-center normal-case text-[10px]"
      >
        {gemLabel}
      </Badge>
    </button>
  );
}
