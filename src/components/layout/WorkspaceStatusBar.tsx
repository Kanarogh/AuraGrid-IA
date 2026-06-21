import { Cloud, Database, Sparkles } from "lucide-react";
import { Badge } from "../ui/Badge";
import { cn } from "../../lib/cn";
import type { AppSection } from "../../lib/sectionMeta";

export function WorkspaceStatusBar({
  brandGemReady,
  brandGemMissingCount = 0,
  apiStatusLabel,
  apiStatusTone,
  storageMode,
  collapsed,
  onOpenSettings,
}: {
  brandGemReady?: boolean;
  brandGemMissingCount?: number;
  apiStatusLabel: string;
  apiStatusTone: "success" | "warning" | "danger";
  storageMode: "postgresql" | "local";
  collapsed?: boolean;
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

  const storageLabel = storageMode === "postgresql" ? "Nuvem" : "Local";

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2 py-1">
        {gemLabel && (
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
        )}
        <span title={apiStatusLabel}>
          <Badge tone={apiStatusTone} dot className="p-2 rounded-lg">
            <Cloud className="h-3.5 w-3.5" aria-hidden />
          </Badge>
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {gemLabel && (
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
      )}
      <Badge tone={apiStatusTone} dot className="w-full justify-center normal-case text-[10px]">
        {apiStatusLabel}
      </Badge>
      <Badge tone="neutral" className="w-full justify-center normal-case text-[10px] gap-1">
        <Database className="h-3 w-3" />
        {storageLabel}
      </Badge>
    </div>
  );
}
