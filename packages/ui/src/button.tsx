import { forwardRef, type ButtonHTMLAttributes, type AnchorHTMLAttributes } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "tertiary";
export type ButtonSize = "md" | "sm";

const base =
  "inline-flex items-center justify-center gap-2 rounded-button font-medium text-button whitespace-nowrap select-none " +
  "transition-colors duration-120 motion-reduce:transition-none disabled:cursor-not-allowed";

const variants: Record<ButtonVariant, string> = {
  // Primary is ink, not teal: teal is reserved for links and selected states (plan §6.1).
  primary: "bg-ink text-white hover:bg-accent-deep active:bg-accent-deep on-dark disabled:bg-stainless",
  secondary: "bg-surface text-ink border border-stainless hover:border-ink hover:bg-ground-deep disabled:text-stainless disabled:border-line",
  tertiary: "bg-transparent text-accent underline underline-offset-[3px] decoration-1 hover:decoration-2 hover:text-accent-deep px-1 disabled:text-stainless",
};

const sizes: Record<ButtonSize, string> = {
  md: "min-h-11 min-w-11 px-5 py-3",
  sm: "min-h-9 min-w-9 px-3 py-1.5 text-small",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  /** Shown instead of children while busy; keeps the width (plan §6.1). */
  busyLabel?: string;
  busy?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", fullWidth, busy, busyLabel, className, children, type = "button", disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-busy={busy || undefined}
      disabled={disabled || busy}
      className={cn(base, variants[variant], variant !== "tertiary" && sizes[size], fullWidth && "w-full", className)}
      {...rest}
    >
      {busy ? (
        <>
          <span aria-hidden className="inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" />
          {busyLabel ?? children}
        </>
      ) : (
        children
      )}
    </button>
  );
});

export interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

/** Anchor styled as a button, for navigation actions ("Browse products"). Pass Next's Link via `as` at the call site if needed. */
export const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(function ButtonLink(
  { variant = "primary", size = "md", fullWidth, className, children, ...rest },
  ref,
) {
  return (
    <a ref={ref} className={cn(base, variants[variant], variant !== "tertiary" && sizes[size], fullWidth && "w-full", className)} {...rest}>
      {children}
    </a>
  );
});
