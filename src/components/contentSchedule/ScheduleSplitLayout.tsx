import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "../../lib/cn";

const STORAGE_KEY = "auragrid:content-schedule-editor-width";
const DEFAULT_WIDTH = 580;
const MIN_WIDTH = 380;
const MAX_WIDTH = 800;

function readStoredWidth(): number {
  if (typeof window === "undefined") return DEFAULT_WIDTH;
  const raw = localStorage.getItem(STORAGE_KEY);
  const n = raw ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return DEFAULT_WIDTH;
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, n));
}

export function ScheduleSplitLayout({
  left,
  right,
  className,
}: {
  left: ReactNode;
  right: ReactNode;
  className?: string;
}) {
  const [editorWidth, setEditorWidth] = useState(readStoredWidth);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(DEFAULT_WIDTH);

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!dragging.current) return;
    const delta = startX.current - e.clientX;
    const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta));
    setEditorWidth(next);
  }, []);

  const onPointerUp = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  }, [onPointerMove]);

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(editorWidth));
  }, [editorWidth]);

  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    dragging.current = true;
    startX.current = e.clientX;
    startWidth.current = editorWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const splitStyle = {
    "--schedule-editor-w": `${editorWidth}px`,
  } as CSSProperties;

  return (
    <div
      className={cn("flex flex-col xl:flex-row xl:items-start gap-5", className)}
      style={splitStyle}
    >
      <div className="flex-1 min-w-0 space-y-4">{left}</div>

      <button
        type="button"
        aria-label="Ajustar largura do painel de edição"
        onPointerDown={startDrag}
        className={cn(
          "hidden xl:flex shrink-0 self-stretch w-2 -mx-0.5 cursor-col-resize rounded-full",
          "hover:bg-ag-accent/20 active:bg-ag-accent/30 transition-colors",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ag-accent/50 items-center justify-center"
        )}
      >
        <span
          className="block h-16 w-1 rounded-full bg-ag-border/80 hover:bg-ag-accent/60 transition-colors"
          aria-hidden
        />
      </button>

      <aside className="w-full min-w-0 xl:w-[var(--schedule-editor-w)] xl:shrink-0">
        {right}
      </aside>
    </div>
  );
}
