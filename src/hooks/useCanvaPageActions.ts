"use client";

import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { confirmDialog } from "../lib/confirmDialog";
import { toast } from "../lib/toast";
import {
  createEmptyCanvaPage,
  prependCanvaPage,
  renumberCanvaPages,
} from "../lib/canva";
import { extractMediaAssetId } from "../lib/api/persistMedia";
import type { CanvaGridPage } from "../types";

type UseCanvaPageActionsArgs = {
  canvaPages: CanvaGridPage[];
  activeCanvaPageId: string;
  setCanvaPages: Dispatch<SetStateAction<CanvaGridPage[]>>;
  setActiveCanvaPageId: Dispatch<SetStateAction<string>>;
  saveCanvaGridNow: () => Promise<void>;
};

export function useCanvaPageActions({
  canvaPages,
  activeCanvaPageId,
  setCanvaPages,
  setActiveCanvaPageId,
  saveCanvaGridNow,
}: UseCanvaPageActionsArgs) {
  const handleDuplicateCanvaPage = useCallback(
    async (pageId: string) => {
      const targetPage = canvaPages.find((p) => p.id === pageId);
      if (!targetPage) return;

      const newId = `page_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const duplicatedPage: CanvaGridPage = {
        id: newId,
        name: `${targetPage.name} (Cópia)`,
        slots: targetPage.slots.map((s, idx) => ({
          id: `slot_${newId}_${idx}`,
          image: s.image,
          imageAssetId: s.imageAssetId ?? extractMediaAssetId(s.image),
          label: s.label,
          matchedCatalogId: s.matchedCatalogId,
        })),
      };

      setCanvaPages((prev) => {
        const idx = prev.findIndex((p) => p.id === pageId);
        if (idx === -1) return renumberCanvaPages([...prev, duplicatedPage]);
        const copy = [...prev];
        copy.splice(idx + 1, 0, duplicatedPage);
        return renumberCanvaPages(copy);
      });
      setActiveCanvaPageId(newId);
      await saveCanvaGridNow();
    },
    [canvaPages, saveCanvaGridNow, setActiveCanvaPageId, setCanvaPages]
  );

  const handleAddCanvaPage = useCallback(async () => {
    const newId = `page_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    setCanvaPages((prev) => prependCanvaPage(prev, newId));
    setActiveCanvaPageId(newId);
    await saveCanvaGridNow();
  }, [saveCanvaGridNow, setActiveCanvaPageId, setCanvaPages]);

  const handleReorderCanvaPages = useCallback(
    async (fromIndex: number, toIndex: number) => {
      setCanvaPages((prev) => {
        const next = [...prev];
        const [moved] = next.splice(fromIndex, 1);
        if (!moved) return prev;
        next.splice(toIndex, 0, moved);
        return renumberCanvaPages(next);
      });
      await saveCanvaGridNow();
    },
    [saveCanvaGridNow, setCanvaPages]
  );

  const handleDeleteCanvaPage = useCallback(
    async (pageId: string) => {
      if (canvaPages.length <= 1) {
        toast.warning("Sua área de trabalho precisa ter pelo menos uma página de planejamento.");
        return;
      }
      if (
        !(await confirmDialog({
          message: "Tem certeza que deseja apagar esta página do Canva Grid?",
          variant: "danger",
          confirmLabel: "Apagar",
        }))
      ) {
        return;
      }
      const deletedIdx = canvaPages.findIndex((p) => p.id === pageId);
      const remainingPages = renumberCanvaPages(canvaPages.filter((p) => p.id !== pageId));
      setCanvaPages(remainingPages);
      if (activeCanvaPageId === pageId && remainingPages.length > 0) {
        const nextIdx = Math.min(Math.max(deletedIdx, 0), remainingPages.length - 1);
        setActiveCanvaPageId(remainingPages[nextIdx]!.id);
      }
      await saveCanvaGridNow();
    },
    [activeCanvaPageId, canvaPages, saveCanvaGridNow, setActiveCanvaPageId, setCanvaPages]
  );

  const handleClearCanvaPage = useCallback(
    async (pageId: string) => {
      if (
        !(await confirmDialog({
          message: "Deseja mesmo zerar todas as fotos desta página?",
          variant: "danger",
          confirmLabel: "Zerar",
        }))
      ) {
        return;
      }
      setCanvaPages((prev) =>
        prev.map((p) => {
          if (p.id !== pageId) return p;
          return createEmptyCanvaPage(p.name, p.id);
        })
      );
      await saveCanvaGridNow();
    },
    [saveCanvaGridNow, setCanvaPages]
  );

  return {
    handleAddCanvaPage,
    handleDeleteCanvaPage,
    handleDuplicateCanvaPage,
    handleReorderCanvaPages,
    handleClearCanvaPage,
  };
}
