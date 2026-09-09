"use client";

import { useId } from "react";
import { cn } from "./cn";

export interface PackVariant {
  id: string;
  /** Pack size as written on the label, e.g. "5 L". */
  label: string;
  /** Preformatted price, e.g. "KES 1,250.00". */
  priceLabel: string;
  available: boolean;
  /** Read out with the option, e.g. "Sold out — ask us when 20 L is back". */
  stockNote?: string;
}

export interface PackSelectorProps {
  variants: readonly PackVariant[];
  value: string | null;
  onChange: (id: string) => void;
  /** Radio group name; defaults to a generated id. */
  name?: string;
  legend?: string;
  className?: string;
}

/**
 * Pack-size radio group (plan §4.7, §7.4). Native radios keep arrow-key navigation and announce the
 * option name, which includes the price. Selected: 2 px accent border (1 px border + 1 px inset ring).
 */
export function PackSelector({ variants, value, onChange, name, legend = "Pack size", className }: PackSelectorProps) {
  const generated = useId();
  const groupName = name ?? `pack-${generated}`;
  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend className="mb-2 text-body font-medium text-ink">{legend}</legend>
      <div className="flex flex-col gap-2">
        {variants.map((v) => {
          const optionId = `${groupName}-${v.id}`;
          const noteId = `${optionId}-note`;
          return (
            <div key={v.id}>
              <label
                htmlFor={optionId}
                className={cn(
                  "flex min-h-12 cursor-pointer items-center gap-3 rounded-chip border border-stainless bg-surface px-4 py-3",
                  "inset-ring-1 inset-ring-transparent transition-colors duration-120 motion-reduce:transition-none",
                  "has-checked:border-accent has-checked:inset-ring-accent",
                  "has-disabled:cursor-not-allowed has-disabled:border-line has-disabled:bg-ground has-disabled:text-ink-muted",
                )}
              >
                <input
                  id={optionId}
                  type="radio"
                  name={groupName}
                  value={v.id}
                  checked={value === v.id}
                  disabled={!v.available}
                  onChange={() => onChange(v.id)}
                  aria-describedby={v.stockNote ? noteId : undefined}
                  className="size-5 shrink-0 accent-accent"
                />
                <span className="flex-1 text-body">{v.label}</span>
                <span className={cn("text-body font-medium tabular-nums", !v.available && "line-through")}>{v.priceLabel}</span>
              </label>
              {v.stockNote ? (
                <p id={noteId} className="mt-1 pl-12 text-small text-ink-muted">
                  {v.stockNote}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
