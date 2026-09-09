"use client";

import { useEffect, type ReactNode } from "react";
import { cn } from "./cn";
import { CloseIcon } from "./icons";

export interface ToastProps {
  open: boolean;
  message: ReactNode;
  onClose: () => void;
  /** Optional action rendered after the message, e.g. "View cart". */
  action?: ReactNode;
  /** Auto-dismiss after this long; 0 keeps it until closed. */
  durationMs?: number;
  closeLabel?: string;
  className?: string;
}

/**
 * Transient confirmation (plan §7.2 radius 12, §7.3 the one float shadow). Bottom-centre on mobile,
 * bottom-right on desktop. The live region stays mounted so the message is announced when it appears.
 * Never the only place an error is shown (plan §6.4).
 */
export function Toast({ open, message, onClose, action, durationMs = 6000, closeLabel = "Dismiss", className }: ToastProps) {
  useEffect(() => {
    if (!open || durationMs <= 0) return;
    const timer = window.setTimeout(onClose, durationMs);
    return () => window.clearTimeout(timer);
  }, [open, durationMs, onClose]);

  return (
    <div role="status" aria-live="polite" className={cn("pointer-events-none fixed inset-x-5 bottom-5 z-50 flex justify-center sm:inset-x-auto sm:right-6 sm:justify-end", className)}>
      {open ? (
        <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-sheet border border-line bg-surface py-3 pl-4 pr-2 text-body text-ink shadow-float">
          <div className="min-w-0 flex-1">{message}</div>
          {action}
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-button text-ink hover:bg-ground-deep"
          >
            <CloseIcon />
          </button>
        </div>
      ) : null}
    </div>
  );
}
