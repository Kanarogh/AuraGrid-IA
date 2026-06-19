"use client";

import type { ReactNode } from "react";
import { ConfirmDialogHost } from "./ConfirmDialogHost";
import { PromptDialogHost } from "./PromptDialogHost";
import { ToastHost } from "./ToastHost";

export function NotificationProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ToastHost />
      <ConfirmDialogHost />
      <PromptDialogHost />
    </>
  );
}
