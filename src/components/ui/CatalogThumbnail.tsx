"use client";

import { useEffect, useRef, useState } from "react";
import { ImageOff } from "lucide-react";
import { requestCatalogMediaUrl, mediaPathFromSrc } from "../../lib/catalogMediaLoader";
import { cn } from "../../lib/cn";

function useLazyInView(rootMargin = "280px", eager = false) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(eager);

  useEffect(() => {
    if (eager || visible) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [eager, visible]);

  return { ref, visible };
}

export function CatalogThumbnail({
  src,
  alt,
  className,
  imgClassName,
  fallbackLabel,
  priority = false,
  lazy = true,
  variant = "thumb",
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  imgClassName?: string;
  fallbackLabel?: string;
  /** Primeira dobra — carrega antes e com prioridade maior na fila. */
  priority?: boolean;
  /** Quando false, carrega imediatamente (slots Canva visíveis, etc.). */
  lazy?: boolean;
  /** thumb = preview leve; full = resolução original (lightbox, zoom). */
  variant?: "thumb" | "full";
}) {
  const eager = priority || !lazy;
  const { ref, visible } = useLazyInView("280px", eager);
  const [displaySrc, setDisplaySrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
    setDisplaySrc(null);
  }, [src, variant]);

  useEffect(() => {
    if (!src || !visible) return;

    let cancelled = false;

    if (!mediaPathFromSrc(src)) {
      setDisplaySrc(src);
      return;
    }

    void requestCatalogMediaUrl(src, {
      priority: priority ? 10 : 0,
      variant,
    })
      .then((url) => {
        if (!cancelled) setDisplaySrc(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [src, visible, priority, variant]);

  if (!src || failed) {
    return (
      <div
        ref={ref}
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

  const showSkeleton = !loaded || !displaySrc;

  return (
    <div ref={ref} className={cn("relative h-full w-full overflow-hidden", className)}>
      {showSkeleton && (
        <div
          className="absolute inset-0 bg-ag-surface-3"
          aria-hidden
        >
          <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-ag-surface-3 via-ag-surface-2 to-ag-surface-3" />
        </div>
      )}
      {displaySrc ? (
        <img
          src={displaySrc}
          alt={alt}
          referrerPolicy="no-referrer"
          draggable={false}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          className={cn(
            "h-full w-full object-cover transition-opacity duration-300",
            loaded ? "opacity-100" : "opacity-0",
            imgClassName
          )}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      ) : null}
    </div>
  );
}
