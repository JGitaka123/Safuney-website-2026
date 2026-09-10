import Image from "next/image";
import Link from "next/link";
import { site } from "@/config/site";

import logoLockup from "@/public/brand/safuney-logo.png";

/**
 * The Safuney mark, redrawn as vector from the logo in PRODUCT CATALOGUE JULY 2024 (page 1): a green
 * "S" that hands over to a blue hose ending in a nozzle, with a leaf on top. The catalogue only
 * carries the logo as a 317 x 118 bitmap, which is soft above about 90 px and unusable as a 512 px
 * app icon, so the mark is traced (ADR 0016). Same geometry as public/brand/safuney-mark.svg and
 * app/icon.svg — change all three together.
 *
 * The mark is two-colour by construction, so it does not take `currentColor`. Where it has to sit on
 * a dark ground, use the lock-up's own white-safe context or the wordmark alone.
 */
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 84 84" className={className} role="img" aria-label={site.shortName} focusable="false">
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M48 11.5 L24 11.5 C12 11.5 3.4 20.5 3.4 33 C3.4 45.5 12 54.5 24 54.5 L55 54.5"
          stroke="var(--color-brand-lime)"
          strokeWidth="7.6"
        />
        <path
          d="M29 32.5 L57 32.5 C69 32.5 78 40.5 78 50.5 L78 57 C78 68 70 76 58 76 L24 76"
          stroke="var(--color-brand-blue)"
          strokeWidth="7.4"
        />
        <circle cx="15.5" cy="75.6" r="5.9" stroke="var(--color-brand-blue)" strokeWidth="4.6" />
      </g>
      <path d="M37 10.6 C45 0.4 67 -1.6 79 10.6 C67 22.8 45 20.8 37 10.6 Z" fill="var(--color-brand-lime)" />
      <path
        d="M46.5 6.2 C54 7.4 61.5 9 68.5 10.6 C61.5 12.2 54 13.8 46.5 15 C50.5 12.6 50.5 8.6 46.5 6.2 Z"
        fill="var(--color-surface)"
      />
    </svg>
  );
}

/**
 * The masthead lock-up: Safuney's own artwork, lifted from the catalogue cover and trimmed, not a
 * reconstruction. It carries the wordmark and the "Clean, safer, healthier" script, which is why it
 * is the raster and not the traced mark — the script cannot be redrawn faithfully by hand.
 *
 * The image is 275 x 84, so at the 44 px display height it is served close to 1:1 on a 2x screen.
 * `priority` because it is inside the LCP viewport on every page.
 */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`inline-flex shrink-0 items-center ${className}`}
      aria-label={`${site.legalName} home`}
    >
      <Image
        src={logoLockup}
        alt={`${site.legalName} — ${site.tagline}`}
        priority
        sizes="(min-width: 640px) 144px, 118px"
        className="h-9 w-auto sm:h-11"
      />
    </Link>
  );
}
