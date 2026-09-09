import type { ReactNode } from "react";
import { cn } from "./cn";

/** GHS-style hazard classes carried by products. NONE renders nothing. */
export type HazardClass = "NONE" | "IRRITANT" | "CORROSIVE" | "OXIDISER" | "FLAMMABLE" | "HARMFUL" | "ENVIRONMENTAL";

export const HAZARDS: readonly Exclude<HazardClass, "NONE">[] = [
  "IRRITANT",
  "CORROSIVE",
  "OXIDISER",
  "FLAMMABLE",
  "HARMFUL",
  "ENVIRONMENTAL",
] as const;

/** Sentence-case hazard word (plan §6.6). */
export const hazardLabel: Record<HazardClass, string> = {
  NONE: "No hazard class",
  IRRITANT: "Irritant",
  CORROSIVE: "Corrosive",
  OXIDISER: "Oxidiser",
  FLAMMABLE: "Flammable",
  HARMFUL: "Harmful",
  ENVIRONMENTAL: "Environmental hazard",
};

/*
 * Pictogram symbols drawn inside a GHS diamond, viewBox 0 0 24 24. Everything uses currentColor so the
 * badge stays in the warning register (plan §2.3) — the zone red is never borrowed for hazards.
 * Irritant and Harmful both carry the GHS07 exclamation mark, as they do on a real label.
 */
const symbols: Record<Exclude<HazardClass, "NONE">, ReactNode> = {
  IRRITANT: (
    <>
      <path d="M12 6.5v6.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="12" cy="16.75" r="1.4" fill="currentColor" />
    </>
  ),
  HARMFUL: (
    <>
      <path d="M12 6.5v6.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="12" cy="16.75" r="1.4" fill="currentColor" />
    </>
  ),
  CORROSIVE: (
    <>
      {/* Two tilted tubes dripping on a bar and a hand: GHS05, simplified */}
      <path d="M7 6.5l2.5 4M17 6.5l-2.5 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9.5 11.5v1.5M14.5 11.5v1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6.5 16.5h4M13.5 16.5h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  OXIDISER: (
    <>
      {/* Flame over a circle: GHS03 */}
      <path d="M12 5.5c1.2 1.6 2.6 2.8 2.6 4.7A2.6 2.6 0 0 1 12 12.8a2.6 2.6 0 0 1-2.6-2.6c0-.9.4-1.5.9-2.1.2.6.6 1 1.1 1.2-.2-1.4.1-2.6.6-3.8z" fill="currentColor" />
      <circle cx="12" cy="16.25" r="2.1" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </>
  ),
  FLAMMABLE: (
    <>
      {/* Flame: GHS02 */}
      <path d="M12 5c1.8 2.3 4 4.2 4 7.2A4 4 0 0 1 12 16.3a4 4 0 0 1-4-4.1c0-1.3.6-2.3 1.4-3.2.3.9.9 1.5 1.7 1.9-.3-2.1.2-4 .9-5.9z" fill="currentColor" />
      <path d="M7.5 18.5h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  ENVIRONMENTAL: (
    <>
      {/* Bare tree and a fish: GHS09, simplified */}
      <path d="M8.5 16.5V9M8.5 11l-2-2M8.5 12.5l2-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12.5 15.5c1.2-1.3 2.6-2 4-2s2.4.8 2.5 2c-.1 1.2-1.1 2-2.5 2s-2.8-.7-4-2z" fill="currentColor" />
      <path d="M12.5 15.5l-1.5-1.3v2.6z" fill="currentColor" />
    </>
  ),
};

export interface HazardPictogramProps {
  hazard: Exclude<HazardClass, "NONE">;
  size?: number;
  className?: string;
}

/** 16 px GHS-diamond pictogram, drawn in currentColor. Decorative: the word is always beside it. */
export function HazardPictogram({ hazard, size = 16, className }: HazardPictogramProps) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" className={cn("shrink-0", className)}>
      <path d="M12 1.5L22.5 12 12 22.5 1.5 12z" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      {symbols[hazard]}
    </svg>
  );
}

export interface HazardBadgeProps {
  hazard: HazardClass;
  className?: string;
}

/** Warning colours, the hazard word and the pictogram (plan §6.6). Colour is never the only carrier. */
export function HazardBadge({ hazard, className }: HazardBadgeProps) {
  if (hazard === "NONE") return null;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-chip bg-warning-wash px-2 py-1 text-label text-warning-ink", className)}>
      <HazardPictogram hazard={hazard} />
      {hazardLabel[hazard]}
    </span>
  );
}
