"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImageOff, RefreshCw } from "lucide-react";
import {
  catalogMediaDisplayUrl,
  clearCatalogMediaCacheFor,
  mediaPathFromSrc,
  peekCatalogMediaUrl,
  requestCatalogMediaUrl,
} from "../../lib/catalogMediaLoader";
import { cn } from "../../lib/cn";

const AUTO_RETRIES = 8;

function useLazyInView(rootMargin = "300px", eager = false) {
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
  const { ref, visible } = useLazyInView("300px", eager);
  const retryCountRef = useRef(0);
  const loadGenRef = useRef(0);

  const [displaySrc, setDisplaySrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  const resolveDirectUrl = useCallback(() => {
    if (!src) return null;
    if (!mediaPathFromSrc(src)) return src;
    return peekCatalogMediaUrl(src, variant) ?? catalogMediaDisplayUrl(src, variant);
  }, [src, variant]);

  useEffect(() => {
    loadGenRef.current += 1;
    retryCountRef.current = 0;
    setFailed(false);
    setLoaded(false);
    setLoading(false);
    setDisplaySrc(null);
  }, [src, variant]);

  const loadViaFetch = useCallback(
    (force = false) => {
      if (!src || !mediaPathFromSrc(src)) return;
      const gen = loadGenRef.current;
      setLoading(true);
      setFailed(false);

      if (force) clearCatalogMediaCacheFor(src);

      void requestCatalogMediaUrl(src, {
        priority: priority ? 12 : 6,
        variant,
      })
        .then((url) => {
          if (gen !== loadGenRef.current) return;
          setDisplaySrc(url);
          setLoading(false);
        })
        .catch(() => {
          if (gen !== loadGenRef.current) return;
          if (retryCountRef.current < AUTO_RETRIES) {
            retryCountRef.current += 1;
            const delay = 500 + retryCountRef.current * 450;
            window.setTimeout(() => loadViaFetch(false), delay);
            return;
          }
          setFailed(true);
          setLoading(false);
        });
    },
    [src, priority, variant]
  );

  useEffect(() => {
    if (!src || !visible) return;
    setDisplaySrc(resolveDirectUrl());
  }, [src, visible, resolveDirectUrl]);

  const handleImgError = useCallback(() => {
    loadViaFetch(false);
  }, [loadViaFetch]);

  const handleRetry = useCallback(() => {
    retryCountRef.current = 0;
    setFailed(false);
    setLoaded(false);
    setDisplaySrc(resolveDirectUrl());
    loadViaFetch(true);
  }, [resolveDirectUrl, loadViaFetch]);

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

  const showSkeleton = visible && (!loaded || !displaySrc || loading);

  return (
    <div ref={ref} className={cn("relative h-full w-full overflow-hidden", className)}>
      {showSkeleton && (
        <div className="absolute inset-0 bg-ag-surface-3" aria-hidden>
          <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-ag-surface-3 via-ag-surface-2 to-ag-surface-3" />
        </div>
      )}
      {visible && displaySrc ? (
        <img
          key={displaySrc}
          src={displaySrc}
          alt={alt}
          referrerPolicy="no-referrer"
          draggable={false}
          decoding="async"
          loading={eager ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "low"}
          className={cn(
            "h-full w-full object-cover transition-opacity duration-200",
            loaded && !loading ? "opacity-100" : "opacity-0",
            imgClassName
          )}
          onLoad={() => setLoaded(true)}
          onError={handleImgError}
        />
      ) : null}
    </div>
  );
}
