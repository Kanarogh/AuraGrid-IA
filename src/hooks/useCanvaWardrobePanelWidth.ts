import { useCallback, useEffect, useRef, useState } from "react";
import {
  PANEL_PCT_MAX,
  PANEL_PCT_MIN,
  PANEL_PCT_STEP,
  PANEL_PCT_DEFAULT,
  clampPanelPct,
  persistPanelPct,
  readStoredPanelPct,
  wardrobePanelStyleFromPct,
} from "../lib/canvaWardrobeLayout";

export function useCanvaWardrobePanelWidth() {
  const splitRef = useRef<HTMLDivElement>(null);
  const [panelWidthPct, setPanelWidthPct] = useState(PANEL_PCT_DEFAULT);
  const [isResizing, setIsResizing] = useState(false);
  const [isXlUp, setIsXlUp] = useState(false);

  useEffect(() => {
    setPanelWidthPct(readStoredPanelPct());
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const sync = () => setIsXlUp(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const updatePanelWidth = useCallback((value: number) => {
    setPanelWidthPct(persistPanelPct(value));
  }, []);

  const updatePanelWidthFromPointer = useCallback(
    (clientX: number) => {
      const container = splitRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const wardrobePx = rect.right - clientX;
      const pct = (wardrobePx / rect.width) * 100;
      updatePanelWidth(pct);
    },
    [updatePanelWidth]
  );

  const startResize = useCallback(
    (clientX: number) => {
      setIsResizing(true);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const onMove = (event: MouseEvent) => updatePanelWidthFromPointer(event.clientX);
      const onUp = () => {
        setIsResizing(false);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      updatePanelWidthFromPointer(clientX);
    },
    [updatePanelWidthFromPointer]
  );

  const nudgePanelWidth = useCallback((delta: number) => {
    setPanelWidthPct((current) => persistPanelPct(current + delta));
  }, []);

  return {
    splitRef,
    panelWidthPct,
    isResizing,
    isXlUp,
    updatePanelWidth,
    startResize,
    nudgePanelWidth,
    wardrobePanelStyle: isXlUp ? wardrobePanelStyleFromPct(panelWidthPct) : undefined,
  };
}

export { clampPanelPct, PANEL_PCT_MAX, PANEL_PCT_MIN, PANEL_PCT_STEP };
