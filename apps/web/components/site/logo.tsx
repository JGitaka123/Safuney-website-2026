import Link from "next/link";
import { site } from "@/config/site";

/**
 * The Safuney mark: a droplet filled to a dose line.
 *
 * Interim until the PO supplies their own artwork (discovery question 5) — but a considered interim
 * rather than a letter in a box, which is what stood here before and could have belonged to any
 * company beginning with S.
 *
 * The idea is the brand idea (plan §1): a surface is clean because the product was measured, not
 * because it looks shiny. So the droplet is drawn as a dosing vessel — the fill stops at a marked
 * line, with the graduation ticks a measuring jug has. It is category-specific in a way a monogram is
 * not, it reads at 16 px in a browser tab, and it works in one colour.
 */
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} role="img" aria-hidden focusable="false">
      {/* Droplet: a point at the top, a circle at the bottom — the shape of a falling drop. */}
      <path
        d="M16 2.5c5.2 6.4 9.5 11.2 9.5 16.2a9.5 9.5 0 0 1-19 0c0-5 4.3-9.8 9.5-16.2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      {/* The dose: filled to the line, not to the brim. */}
      <path d="M6.9 18.7a9.5 9.5 0 0 0 18.2 0z" fill="currentColor" opacity="0.9" />
      {/* Graduations, as on a dosing jug. */}
      <path d="M9.5 14.4h3M9.5 11.2h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`inline-flex shrink-0 items-center gap-2.5 text-ink ${className}`}
      aria-label={`${site.legalName} home`}
    >
      <LogoMark className="size-8 text-accent" />
      <span className="text-h4 font-medium tracking-tight">{site.shortName}</span>
    </Link>
  );
}
