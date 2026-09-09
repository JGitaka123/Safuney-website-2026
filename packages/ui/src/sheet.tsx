"use client";

import { cloneElement, isValidElement, useEffect, useId, useRef, useState, type MouseEvent, type ReactElement, type ReactNode } from "react";
import { cn } from "./cn";

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Visually hidden description for screen readers. */
  description?: string;
  side?: "right" | "bottom";
  children: ReactNode;
  /** Optional trigger element rendered in place; it receives the click handler and aria state. */
  trigger?: ReactNode;
  closeLabel?: string;
}

/** Exit animation length (plan §5); the timer, not animationend, closes the dialog so reduced motion still closes. */
const EXIT_MS = 160;

/**
 * Slide-in sheet (plan §5 motion, §7.2 radius 12 on the leading corners, §7.3 the one float shadow).
 * Built on the native <dialog> in modal mode: the browser traps focus, makes the page inert, restores
 * focus on close and closes on Escape, so no dialog library ships to every page (ADR 0005 budget).
 */
export function Sheet({ open, onOpenChange, title, description, side = "right", children, trigger, closeLabel = "Close" }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [state, setState] = useState<"closed" | "open" | "closing">(open ? "open" : "closed");

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
      setState("open");
      return;
    }
    if (!dialog.open) return;
    setState("closing");
    const timer = setTimeout(() => {
      dialog.close();
      setState("closed");
    }, EXIT_MS);
    return () => clearTimeout(timer);
  }, [open]);

  // The native modal dialog does not stop the page behind it from scrolling.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const requestClose = () => onOpenChange(false);

  const triggerElement = isValidElement(trigger)
    ? cloneElement(trigger as ReactElement<{ onClick?: (e: MouseEvent<HTMLElement>) => void; "aria-haspopup"?: string; "aria-expanded"?: boolean }>, {
        onClick: (e: MouseEvent<HTMLElement>) => {
          (trigger as ReactElement<{ onClick?: (e: MouseEvent<HTMLElement>) => void }>).props.onClick?.(e);
          if (!e.defaultPrevented) onOpenChange(true);
        },
        "aria-haspopup": "dialog",
        "aria-expanded": open,
      })
    : trigger;

  return (
    <>
      {triggerElement}
      <dialog
        ref={ref}
        data-state={state}
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        onCancel={(e) => {
          // Escape: animate out instead of the instant native close.
          e.preventDefault();
          requestClose();
        }}
        onClick={(e) => {
          // A click on the backdrop lands on the dialog element itself, never on its children.
          if (e.target === e.currentTarget) requestClose();
        }}
        className={cn(
          "fixed m-0 flex max-h-none max-w-none flex-col border-0 bg-surface p-0 text-ink shadow-float motion-reduce:animate-none",
          "backdrop:bg-ink/40 data-[state=open]:backdrop:animate-[fade-in_240ms_var(--ease-sheet)] data-[state=closing]:backdrop:animate-[fade-out_160ms_var(--ease-sheet)_forwards]",
          "data-[state=closed]:hidden open:flex focus:outline-none",
          side === "right" &&
            "inset-y-0 left-auto right-0 h-full w-[min(100vw,22rem)] rounded-l-sheet data-[state=open]:animate-[slide-in-right_240ms_var(--ease-sheet)] data-[state=closing]:animate-[slide-out-right_160ms_var(--ease-sheet)_forwards]",
          side === "bottom" &&
            "inset-x-0 bottom-0 top-auto max-h-[85vh] w-full rounded-t-sheet data-[state=open]:animate-[slide-in-bottom_240ms_var(--ease-sheet)] data-[state=closing]:animate-[slide-out-bottom_160ms_var(--ease-sheet)_forwards]",
        )}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 id={titleId} className="text-h4">
            {title}
          </h2>
          <button
            type="button"
            onClick={requestClose}
            className="inline-flex size-11 items-center justify-center rounded-button text-ink hover:bg-ground-deep"
            aria-label={closeLabel}
          >
            <svg aria-hidden width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </div>
        {description ? (
          <p id={descriptionId} className="sr-only">
            {description}
          </p>
        ) : null}
        <div className="flex-1 overflow-y-auto">{state === "closed" ? null : children}</div>
      </dialog>
    </>
  );
}
