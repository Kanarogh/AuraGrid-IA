import type { InputHTMLAttributes, TextareaHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

const fieldClass =
  "w-full rounded-lg border border-ag-border bg-ag-surface-2 text-ag-text text-sm px-3.5 py-2.5 outline-none transition-colors placeholder:text-ag-muted/70 ag-focus-ring focus:border-[var(--ag-focus-border)]";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldClass, className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(fieldClass, "resize-y min-h-[88px] leading-relaxed", className)}
      {...props}
    />
  );
}

export function FieldLabel({
  children,
  htmlFor,
}: {
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="text-[10px] uppercase font-mono tracking-widest text-ag-muted font-semibold block mb-1.5"
    >
      {children}
    </label>
  );
}
