"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImageOff, RefreshCw } from "lucide-react";
import {
  catalogMediaDisplayUrl,
  mediaPathFromSrc,
  peekCatalogMediaUrl,
  requestCatalogMediaUrl,
} from "../../lib/catalogMediaLoader";
import { cn } from "../../lib/cn";

function useLazyInView(rootMargin = "400px", eager = false) {
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
  priority?: boolean;
  lazy?: boolean;
  variant?: "thumb" | "full";
}) {
  const eager = priority || !lazy;
  const { ref, visible } = useLazyInView("400px", eager);
  const retryCountRef = useRef(0);

  const directUrl = useMemo(() => {
    if (!src) return null;
    if (!mediaPathFromSrc(src)) return src;
    return peekCatalogMediaUrl(src, variant) ?? catalogMediaDisplayUrl(src, variant);
  }, [src, variant]);

  const [displaySrc, setDisplaySrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    retryCountRef.current = 0;
    setFailed(false);
    setLoaded(false);
    setUsingFallback(false);
    setDisplaySrc(null);
  }, [src, variant]);

  useEffect(() => {
    if (!src || !visible) return;
    setDisplaySrc(directUrl);
  }, [src, visible, directUrl]);

  const loadViaFetch = useCallback(() => {
    if (!src || !mediaPathFromSrc(src)) return;
    setUsingFallback(true);
    setFailed(false);
    setLoaded(false);
    void requestCatalogMediaUrl(src, {
      priority: priority ? 10 : 5,
      variant,
    })
      .then((url) => {
        setDisplaySrc(url);
        setUsingFallback(false);
      })
      .catch(() => {
        if (retryCountRef.current < 2) {
          retryCountRef.current += 1;
          window.setTimeout(loadViaFetch, 600 * retryCountRef.current);
          return;
        }
        setFailed(true);
        setUsingFallback(false);
      });
  }, [src, priority, variant]);

  const handleImgError = useCallback(() => {
    loadViaFetch();
  }, [loadViaFetch]);

  const handleRetry = useCallback(() => {
    retryCountRef.current = 0;
    setFailed(false);
    setLoaded(false);
    if (directUrl) setDisplaySrc(directUrl);
    else loadViaFetch();
  }, [directUrl, loadViaFetch]);

  if (!src) {
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

  if (failed) {
    return (
      <div
        ref={ref}
        className={cn(
          "flex h-full w-full flex-col items-center justify-center gap-1.5 bg-ag-surface-3 p-2 text-center",
          className
        )}
      >
        <ImageOff className="h-5 w-5 text-ag-muted" />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleRetry();
          }}
          className="flex items-center gap-1 text-[9px] font-semibold text-ag-accent hover:underline cursor-pointer"
        >
          <RefreshCw className="h-3 w-3" />
          Tentar de novo
        </button>
      </div>
    );
  }

  const showSkeleton = visible && (!loaded || !displaySrc || usingFallback);

  return (
    <div ref={ref} className={cn("relative h-full w-full overflow-hidden", className)}>
      {showSkeleton && (
        <div className="absolute inset-0 bg-ag-surface-3" aria-hidden>
          <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-ag-surface-3 via-ag-surface-2 to-ag-surface-3" />
        </div>
      )}
      {visible && displaySrc ? (
        <img
          src={displaySrc}
          alt={alt}
          referrerPolicy="no-referrer"
          draggable={false}
          decoding="async"
          loading={eager ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          className={cn(
            "h-full w-full object-cover transition-opacity duration-200",
            loaded && !usingFallback ? "opacity-100" : "opacity-0",
            imgClassName
          )}
          onLoad={() => setLoaded(true)}
          onError={handleImgError}
        />
      ) : null}
    </div>
  );
}
