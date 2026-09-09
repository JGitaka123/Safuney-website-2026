"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { cn } from "./cn";

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Visually hidden description for screen readers. */
  description?: string;
  side?: "right" | "bottom";
  children: ReactNode;
  /** Optional trigger element rendered in place. */
  trigger?: ReactNode;
  closeLabel?: string;
}

/**
 * Slide-in sheet (plan §5 motion, §7.2 radius 12 on the leading corners, §7.3 the one float shadow).
 * Traps focus, restores it on close, closes on Escape (Radix).
 */
export function Sheet({ open, onOpenChange, title, description, side = "right", children, trigger, closeLabel = "Close" }: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40 data-[state=open]:animate-[fade-in_240ms_var(--ease-sheet)] data-[state=closed]:animate-[fade-out_160ms_var(--ease-sheet)] motion-reduce:animate-none" />
        <Dialog.Content
          className={cn(
            "fixed z-50 flex flex-col bg-surface shadow-float focus:outline-none motion-reduce:animate-none",
            side === "right" &&
              "inset-y-0 right-0 w-[min(100vw,22rem)] rounded-l-sheet data-[state=open]:animate-[slide-in-right_240ms_var(--ease-sheet)] data-[state=closed]:animate-[slide-out-right_160ms_var(--ease-sheet)]",
            side === "bottom" &&
              "inset-x-0 bottom-0 max-h-[85vh] rounded-t-sheet data-[state=open]:animate-[slide-in-bottom_240ms_var(--ease-sheet)] data-[state=closed]:animate-[slide-out-bottom_160ms_var(--ease-sheet)]",
          )}
        >
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <Dialog.Title className="text-h4">{title}</Dialog.Title>
            <Dialog.Close
              className="inline-flex size-11 items-center justify-center rounded-button text-ink hover:bg-ground-deep"
              aria-label={closeLabel}
            >
              <svg aria-hidden width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
            </Dialog.Close>
          </div>
          {description ? <Dialog.Description className="sr-only">{description}</Dialog.Description> : null}
          <div className="flex-1 overflow-y-auto">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
