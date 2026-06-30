"use client";

import { CatalogThumbnail } from "../ui/CatalogThumbnail";
import { cn } from "../../lib/cn";
import type { EnrichProgressPhase } from "../../lib/enrichProgressStages";
import { useSmoothEnrichPercent } from "../../hooks/useSmoothEnrichPercent";

export function CatalogEnrichImageOverlay({
  src,
  alt,
  percent,
  stepLabel,
  phase,
  resetKey,
  priority = false,
  className,
}: {
  src: string | null | undefined;
  alt: string;
  percent?: number;
  stepLabel: string;
  phase?: EnrichProgressPhase;
  resetKey?: string;
  priority?: boolean;
  className?: string;
}) {
  const hasPercent = typeof percent === "number" && Number.isFinite(percent);
  const smoothPercent = useSmoothEnrichPercent(hasPercent ? percent : undefined, {
    phase,
    active: hasPercent,
    resetKey,
  });
  const p =
    typeof smoothPercent === "number"
      ? Math.min(100, Math.max(0, smoothPercent))
      : undefined;
  const indeterminate = p === undefined;

  return (
    <div
      className={cn("absolute inset-0 z-10 overflow-hidden rounded-xl pointer-events-none", className)}
      role="progressbar"
      aria-valuenow={p}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={stepLabel}
    >
      <div className="absolute inset-0 bg-ag-surface-1">
        <CatalogThumbnail
          src={src}
          alt=""
          priority={priority}
          imgClassName="object-contain grayscale contrast-[0.85] brightness-[0.72]"
        />
      </div>

      {!indeterminate && (
        <div
          className="absolute inset-0 will-change-[clip-path]"
          style={{
            clipPath: `inset(${100 - p}% 0 0 0)`,
            transition: "clip-path 80ms linear",
          }}
        >
          <CatalogThumbnail
            src={src}
            alt=""
            priority={priority}
            imgClassName="object-contain"
          />
        </div>
      )}

      {indeterminate && (
        <div className="absolute inset-0 bg-ag-accent/10 animate-pulse" aria-hidden />
      )}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-2 pb-2 pt-8">
        <p className="text-[9px] font-semibold text-white truncate leading-tight" title={stepLabel}>
          {stepLabel}
        </p>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/20">
          {indeterminate ? (
            <div className="h-full w-8 rounded-full bg-ag-accent animate-pulse" />
          ) : (
            <div
              className="h-full rounded-full bg-ag-accent"
              style={{
                width: `${p}%`,
                transition: "width 80ms linear",
              }}
            />
          )}
        </div>
        {!indeterminate && (
          <p className="mt-0.5 text-[8px] font-mono tabular-nums text-white/75">{p}%</p>
        )}
      </div>
    </div>
  );
}
