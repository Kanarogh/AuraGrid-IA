"use client";

import { useEffect, useRef, useState } from "react";
import type { EnrichProgressPhase } from "../lib/enrichProgressStages";

/** Teto de creep por fase — para 1 ponto antes do próximo marco do servidor. */
function phaseCeiling(phase: EnrichProgressPhase | undefined, target: number): number {
  switch (phase) {
    case "prepare":
      return 10;
    case "download":
      return 17;
    case "analyze":
      return 51;
    case "refine":
      return 85;
    case "save":
      return 97;
    case "embed":
      return 99;
    case "done":
      return 100;
    default:
      if (target < 18) return 17;
      if (target < 55) return 51;
      if (target < 88) return 85;
      if (target < 94) return 93;
      return 99;
  }
}

/** Velocidade de creep (%/s) enquanto aguarda resposta longa da IA. */
function creepRate(phase: EnrichProgressPhase | undefined): number {
  switch (phase) {
    case "analyze":
    case "refine":
      return 0.7;
    case "embed":
      return 0.45;
    case "download":
      return 1.4;
    default:
      return 2;
  }
}

/**
 * Interpola suavemente entre marcos do servidor: salta rápido ao novo alvo
 * e avança devagar até o teto da fase enquanto o Gemini responde.
 */
export function useSmoothEnrichPercent(
  target: number | undefined,
  options?: {
    phase?: EnrichProgressPhase;
    active?: boolean;
    /** Troca de SKU — zera o display */
    resetKey?: string;
  }
): number | undefined {
  const { phase, active = true, resetKey } = options ?? {};
  const [display, setDisplay] = useState<number | undefined>(target);
  const displayRef = useRef(typeof target === "number" ? target : 0);
  const targetRef = useRef(target);
  const phaseRef = useRef(phase);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    targetRef.current = target;
    phaseRef.current = phase;
  }, [target, phase]);

  useEffect(() => {
    displayRef.current = 0;
    setDisplay(target);
    if (typeof target === "number") displayRef.current = target;
  }, [resetKey]);

  useEffect(() => {
    if (!active || typeof target !== "number" || !Number.isFinite(target)) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      setDisplay(undefined);
      return;
    }

    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(120, now - last) / 1000;
      last = now;

      const tgt = targetRef.current ?? 0;
      const ph = phaseRef.current;
      let current = displayRef.current;
      const ceiling =
        ph === "done" || tgt >= 100 ? 100 : phaseCeiling(ph, tgt);

      if (tgt > current + 0.25) {
        // Marco novo do servidor — converge rápido (ex.: 22 → 48)
        current += (tgt - current) * Math.min(1, dt * 6);
      } else if (current < tgt) {
        current = tgt;
      } else if (current < ceiling) {
        current = Math.min(ceiling, current + creepRate(ph) * dt);
      }

      displayRef.current = current;
      const rounded = Math.round(current);
      setDisplay((prev) => (prev === rounded ? prev : rounded));
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [active, target, phase, resetKey]);

  return display;
}
