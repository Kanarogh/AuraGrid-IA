"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/cn";

export type FloatingPlacement = "bottom-start" | "top-start" | "right-start" | "left-start";

type FloatingPopoverProps = {
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  placement?: FloatingPlacement;
  children: ReactNode;
  className?: string;
  matchAnchorWidth?: boolean;
  backdrop?: boolean;
  zIndex?: number;
  role?: string;
};

const GAP = 6;

function computePosition(
  anchor: DOMRect,
  popover: DOMRect,
  placement: FloatingPlacement,
  matchWidth: boolean
): { top: number; left: number; width: number | undefined } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let top = 0;
  let left = 0;
  let resolved = placement;

  const tryBottom = () => {
    top = anchor.bottom + GAP;
    left = anchor.left;
    resolved = "bottom-start";
  };
  const tryTop = () => {
    top = anchor.top - popover.height - GAP;
    left = anchor.left;
    resolved = "top-start";
  };
  const tryRight = () => {
    top = anchor.top;
    left = anchor.right + GAP;
    resolved = "right-start";
  };
  const tryLeft = () => {
    top = anchor.top;
    left = anchor.left - popover.width - GAP;
    resolved = "left-start";
  };

  if (placement === "bottom-start") tryBottom();
  else if (placement === "top-start") tryTop();
  else if (placement === "right-start") tryRight();
  else tryLeft();

  if (resolved === "bottom-start" && top + popover.height > vh - 8) tryTop();
  if (resolved === "top-start" && top < 8) tryBottom();
  if (resolved === "right-start" && left + popover.width > vw - 8) tryLeft();
  if (resolved === "left-start" && left < 8) tryRight();

  const width =
    matchWidth && (placement === "bottom-start" || placement === "top-start")
      ? anchor.width
      : undefined;
  const effectiveWidth = width ?? popover.width;
  left = Math.min(Math.max(8, left), vw - effectiveWidth - 8);
  top = Math.min(Math.max(8, top), vh - popover.height - 8);

  return { top, left, width };
}

export function FloatingPopover({
  anchorRef,
  open,
  onClose,
  placement = "bottom-start",
  children,
  className,
  matchAnchorWidth = true,
  backdrop = false,
  zIndex = 100,
  role,
}: FloatingPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: undefined as number | undefined });

  useLayoutEffect(() => {
    if (!open || !anchorRef.current || !popoverRef.current) return;

    const update = () => {
      if (!anchorRef.current || !popoverRef.current) return;
      const anchor = anchorRef.current.getBoundingClientRect();
      const popover = popoverRef.current.getBoundingClientRect();
      const match =
        matchAnchorWidth &&
        (placement === "bottom-start" || placement === "top-start");
      setPosition(computePosition(anchor, popover, placement, match));
    };

    update();
    const raf = requestAnimationFrame(update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, anchorRef, placement, matchAnchorWidth, children]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <>
      {backdrop && (
        <button
          type="button"
          aria-label="Fechar"
          className="fixed inset-0 cursor-default bg-black/5"
          style={{ zIndex: zIndex - 1 }}
          onClick={onClose}
        />
      )}
      <div
        ref={popoverRef}
        role={role}
        className={cn(
          "fixed rounded-xl border border-ag-border bg-ag-surface-1 shadow-lg overflow-hidden",
          className
        )}
        style={{
          top: position.top,
          left: position.left,
          width: position.width,
          zIndex,
        }}
      >
        {children}
      </div>
    </>,
    document.body
  );
}
