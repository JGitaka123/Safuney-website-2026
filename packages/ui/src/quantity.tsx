"use client";

import { useId, useState, type ChangeEvent, type FocusEvent } from "react";
import { cn } from "./cn";

export interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  /** Visible label; also names the group and the live announcement. */
  label?: string;
  /** What is being counted, for the announcement: "4 of 5 L". */
  unitLabel?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * [-] value [+] with an editable number in the middle (plan §4.7). Targets are 44 px; the buttons carry
 * their outcome as accessible names. A polite live region announces the new quantity after a press.
 */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  label = "Quantity",
  unitLabel,
  id: explicitId,
  disabled,
  className,
}: QuantityStepperProps) {
  const generated = useId();
  const inputId = explicitId ?? `quantity-${generated}`;
  const labelId = `${inputId}-label`;
  const [draft, setDraft] = useState<string | null>(null);

  const commit = (raw: string) => {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) {
      setDraft(null);
      return;
    }
    const next = clamp(parsed, min, max);
    setDraft(null);
    if (next !== value) onChange(next);
  };

  const buttonClass =
    "inline-flex size-11 shrink-0 items-center justify-center bg-surface text-ink border border-stainless " +
    "hover:bg-ground-deep disabled:cursor-not-allowed disabled:border-line disabled:text-stainless";

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <label id={labelId} htmlFor={inputId} className="text-body font-medium text-ink">
        {label}
      </label>
      <div role="group" aria-labelledby={labelId} className="inline-flex">
        <button
          type="button"
          onClick={() => onChange(clamp(value - 1, min, max))}
          disabled={disabled || value <= min}
          aria-label="Decrease quantity"
          className={cn(buttonClass, "rounded-l-chip")}
        >
          <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 8h10" />
          </svg>
        </button>
        <input
          id={inputId}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={1}
          value={draft ?? String(value)}
          disabled={disabled}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft(e.target.value)}
          onBlur={(e: FocusEvent<HTMLInputElement>) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit(e.currentTarget.value);
          }}
          className={cn(
            "h-11 w-16 border-y border-stainless bg-surface text-center text-body text-ink tabular-nums",
            "focus:border-accent focus:inset-ring-1 focus:inset-ring-accent",
            "disabled:cursor-not-allowed disabled:border-line disabled:bg-ground-deep disabled:text-stainless",
            "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
          )}
        />
        <button
          type="button"
          onClick={() => onChange(clamp(value + 1, min, max))}
          disabled={disabled || value >= max}
          aria-label="Increase quantity"
          className={cn(buttonClass, "rounded-r-chip")}
        >
          <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 8h10M8 3v10" />
          </svg>
        </button>
      </div>
      <span className="sr-only" aria-live="polite">
        {label} {value}
        {unitLabel ? ` of ${unitLabel}` : ""}
      </span>
    </div>
  );
}
