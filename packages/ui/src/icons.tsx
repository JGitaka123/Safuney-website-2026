import type { SVGProps } from "react";
import { cn } from "./cn";

type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & { size?: number };

/** Filled circle with a white "!" — the error mark (plan §2.3). Colour comes from `currentColor`. */
export function AlertMarkIcon({ size = 20, className, ...rest }: IconProps) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 20 20" className={cn("shrink-0", className)} {...rest}>
      <circle cx="10" cy="10" r="10" fill="currentColor" />
      <path d="M10 4.5v7" className="stroke-white" strokeWidth="2.25" strokeLinecap="round" />
      <circle cx="10" cy="14.75" r="1.25" className="fill-white" />
    </svg>
  );
}

/** Tick — success and completed states (plan §2.3, §5). */
export function TickIcon({ size = 20, className, ...rest }: IconProps) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0", className)}
      {...rest}
    >
      <path d="M4 10.5l4 4 8-9" />
    </svg>
  );
}

/** Small chevron used by the native select. */
export function ChevronDownIcon({ size = 16, className, ...rest }: IconProps) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0", className)}
      {...rest}
    >
      <path d="M3 6l5 5 5-5" />
    </svg>
  );
}

/** Close cross for toasts and dismissible panels. */
export function CloseIcon({ size = 16, className, ...rest }: IconProps) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={cn("shrink-0", className)}
      {...rest}
    >
      <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
    </svg>
  );
}
