"use client";

import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { apiFetch } from "../../lib/api/apiClient";
import { cn } from "../../lib/cn";

const blobCache = new Map<string, string>();

function mediaPathFromSrc(src: string): string | null {
  if (src.startsWith("/api/v1/media/")) return src.split("?")[0]!;
  return null;
}

async function fetchMediaBlobUrl(path: string): Promise<string> {
  const cached = blobCache.get(path);
  if (cached) return cached;

  const res = await apiFetch(path);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  blobCache.set(path, objectUrl);
  return objectUrl;
}

export function CatalogThumbnail({
  src,
  alt,
  className,
  imgClassName,
  fallbackLabel,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  imgClassName?: string;
  fallbackLabel?: string;
}) {
  const [displaySrc, setDisplaySrc] = useState<string | null>(src ?? null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setFailed(false);
    setLoading(false);
    setDisplaySrc(src ?? null);
  }, [src]);

  useEffect(() => {
    if (!failed || !src) return;
    const path = mediaPathFromSrc(src);
    if (!path) return;

    let cancelled = false;
    setLoading(true);
    void fetchMediaBlobUrl(path)
      .then((url) => {
        if (!cancelled) {
          setDisplaySrc(url);
          setFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [failed, src]);

  if (!src || failed) {
    return (
      <div
        className={cn(
          "flex h-full w-full flex-col items-center justify-center gap-1 bg-ag-surface-3 p-2 text-center",
          className
        )}
      >
        <ImageOff className="h-5 w-5 text-ag-muted" />
        {fallbackLabel ? (
          <span className="text-[8px] font-mono font-bold uppercase leading-tight text-ag-muted line-clamp-2">
            {fallbackLabel}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("relative h-full w-full", className)}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-ag-surface-3/80">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-ag-accent border-t-transparent" />
        </div>
      )}
      <img
        src={displaySrc ?? undefined}
        alt={alt}
        referrerPolicy="no-referrer"
        draggable={false}
        className={cn("h-full w-full object-cover", imgClassName)}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
