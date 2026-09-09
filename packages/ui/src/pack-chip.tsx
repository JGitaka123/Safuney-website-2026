import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export type PackChipProps = HTMLAttributes<HTMLSpanElement>;

/** Pack size on a card: mono-sm, ground-deep fill, 2 px radius. Describes, never selects (plan §6.6). */
export function PackChip({ className, children, ...rest }: PackChipProps) {
  return (
    <span
      className={cn("inline-flex items-center rounded-chip bg-ground-deep px-2 py-1 font-mono text-mono-sm text-ink tabular-nums", className)}
      {...rest}
    >
      {children}
    </span>
  );
}
