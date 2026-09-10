import { cn } from "./cn";
import { zoneMeta, type ZoneKey } from "./zone";

/**
 * A drawn pack shot, standing in for photography.
 *
 * The design plan (§8) says product tiles carry a flat square with the product name until the PO's
 * photographs exist, and bans illustration. That rule was written to stop generic stock imagery and
 * abstract blobs creeping in — and it was right about those. But a grid of grey squares reads as an
 * unfinished site rather than a deliberate one, and a professional buyer comparing us with Arco or
 * Ecolab notices immediately.
 *
 * So: the container is drawn from what the variant actually is. A 5 L concentrate gets a jerrican, a
 * 500 ml hand sanitiser gets a bottle, a 15 kg destainer gets a pail, a 20 L bleach gets a drum. The
 * label carries the real pack size and the zone colour. Nothing here is decorative — every line comes
 * from a field in the database, which is why it survives the "no placeholder" rule and why it will
 * still look right when the catalogue changes.
 *
 * Replaced by photography the day it arrives: this is the `image` slot of `ProductCard`, not a
 * replacement for it.
 */
export type PackKind = "jerrican" | "bottle" | "drum" | "pail" | "carton";

export interface PackShotProps {
  /** As written on the label, e.g. "5 L", "20 L", "500 ml". Drawn onto the label panel. */
  packLabel: string;
  /** Unit from the catalogue; decides the container together with the size. */
  unit?: "L" | "ML" | "KG" | "G" | "PCS";
  /** Numeric pack size, so 1 L and 20 L are not the same drawing. */
  size?: number;
  zones?: readonly ZoneKey[];
  /** Overrides the derived container when a product is a known shape. */
  kind?: PackKind;
  /**
   * A product tile wants the white square behind the pack, because the frame is part of the card.
   * A group of overlapping packs does not — the opaque square of the pack in front clips the one
   * behind it, which is what hid the "20 L" and "1 L" labels in the first hero build.
   */
  transparent?: boolean;
  className?: string;
}

/** Litres or kilos, whichever the unit means, so the thresholds below read in one scale. */
function normalise(unit: PackShotProps["unit"], size: number): number {
  if (unit === "ML" || unit === "G") return size / 1000;
  return size;
}

export function packKindFor(unit: PackShotProps["unit"], size: number): PackKind {
  if (unit === "PCS") return "carton";
  const n = normalise(unit, size);
  if (unit === "KG" || unit === "G") return n >= 10 ? "pail" : "carton";
  if (n >= 18) return "drum";
  if (n >= 3) return "jerrican";
  return "bottle";
}

/** The pack's own colour: its zone where it has one, the house teal where it does not. */
function accentFor(zones: readonly ZoneKey[]): { fill: string; deep: string } {
  const zone = zones[0] ? zoneMeta(zones[0]) : undefined;
  switch (zone?.key) {
    case "RED":
      return { fill: "#b8132a", deep: "#8d0e20" };
    case "BLUE":
      return { fill: "#1747c2", deep: "#113694" };
    case "GREEN":
      return { fill: "#137035", deep: "#0e5227" };
    case "YELLOW":
      return { fill: "#f2c200", deep: "#c49e00" };
    default:
      return { fill: "#0e50a8", deep: "#0b4592" };
  }
}

const LIQUID = "#e6ecf0";
const OUTLINE = "#10202b";

export function PackShot({ packLabel, unit = "L", size = 5, zones = [], kind, transparent = false, className }: PackShotProps) {
  const shape = kind ?? packKindFor(unit, size);
  const accent = accentFor(zones);
  const onYellow = accent.fill === "#f2c200";
  const labelInk = onYellow ? "#10202b" : "#ffffff";

  return (
    <svg
      viewBox="0 0 200 200"
      className={cn("h-full w-full", className)}
      role="img"
      aria-label={`${packLabel} pack`}
      preserveAspectRatio="xMidYMid meet"
    >
      {transparent ? null : <rect width="200" height="200" fill="#ffffff" />}
      {/* The surface the pack stands on, so it does not float. */}
      <ellipse cx="100" cy="176" rx={shape === "drum" ? 46 : 38} ry="6" fill="#10202b" opacity="0.07" />

      {shape === "jerrican" ? <Jerrican accent={accent} /> : null}
      {shape === "bottle" ? <Bottle accent={accent} /> : null}
      {shape === "drum" ? <Drum accent={accent} /> : null}
      {shape === "pail" ? <Pail accent={accent} /> : null}
      {shape === "carton" ? <Carton accent={accent} /> : null}

      {/* Pack size, set on the label panel exactly as the catalogue writes it. */}
      <text
        x={shape === "carton" ? 79 : 100}
        y={shape === "carton" ? 131 : shape === "pail" ? 134 : 126}
        textAnchor="middle"
        fontFamily='"IBM Plex Sans", system-ui, sans-serif'
        fontSize={shape === "carton" ? 13 : packLabel.length > 6 ? 15 : 19}
        fontWeight="600"
        fill={labelInk}
        letterSpacing="-0.3"
      >
        {packLabel}
      </text>
    </svg>
  );
}

interface ShapeProps {
  accent: { fill: string; deep: string };
}

/** 5–15 L stackable concentrate can — the shape most of this catalogue actually ships in. */
function Jerrican({ accent }: ShapeProps) {
  return (
    <g>
      <path
        d="M62 62 h30 v-8 a4 4 0 0 1 4-4 h8 a4 4 0 0 1 4 4 v8 h30 a8 8 0 0 1 8 8 v92 a8 8 0 0 1-8 8 H62 a8 8 0 0 1-8-8 V70 a8 8 0 0 1 8-8 z"
        fill="#f7fafb"
        stroke={OUTLINE}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Handle cut into the shoulder. */}
      <path d="M66 70 h22 v18 a4 4 0 0 1-4 4 H70 a4 4 0 0 1-4-4 z" fill="#ffffff" stroke={OUTLINE} strokeWidth="2.5" strokeLinejoin="round" />
      {/* Cap. */}
      <rect x="94" y="40" width="24" height="14" rx="3" fill={accent.deep} stroke={OUTLINE} strokeWidth="2.5" />
      {/* Label panel: the accent block that carries the pack size. */}
      <rect x="62" y="100" width="76" height="46" fill={accent.fill} />
      <rect x="62" y="100" width="76" height="46" fill="none" stroke={OUTLINE} strokeWidth="2" />
      {/* Liquid level line, the detail that makes it read as full rather than empty. */}
      <path d="M54 152 h92" stroke={OUTLINE} strokeWidth="1.5" opacity="0.25" />
      <rect x="56" y="153" width="88" height="15" fill={LIQUID} opacity="0.6" />
    </g>
  );
}

/** Ready-to-use bottle, up to about 2 L. */
function Bottle({ accent }: ShapeProps) {
  return (
    <g>
      <rect x="90" y="34" width="20" height="18" rx="2" fill={accent.deep} stroke={OUTLINE} strokeWidth="2.5" />
      <path d="M92 52 h16 l10 16 a10 10 0 0 1 2 6 v90 a8 8 0 0 1-8 8 H88 a8 8 0 0 1-8-8 V74 a10 10 0 0 1 2-6 z" fill="#f7fafb" stroke={OUTLINE} strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="80" y="102" width="40" height="44" fill={accent.fill} />
      <rect x="80" y="102" width="40" height="44" fill="none" stroke={OUTLINE} strokeWidth="2" />
      <rect x="82" y="152" width="36" height="14" fill={LIQUID} opacity="0.6" />
    </g>
  );
}

/** 20 L and up: the drum a facilities buyer orders by the pallet. */
function Drum({ accent }: ShapeProps) {
  return (
    <g>
      <ellipse cx="100" cy="52" rx="42" ry="10" fill="#ffffff" stroke={OUTLINE} strokeWidth="2.5" />
      <path d="M58 52 v106 a42 10 0 0 0 84 0 V52" fill="#f7fafb" stroke={OUTLINE} strokeWidth="2.5" />
      {/* Rolling hoops — what makes a drum a drum. */}
      <path d="M58 78 a42 10 0 0 0 84 0" fill="none" stroke={OUTLINE} strokeWidth="1.5" opacity="0.4" />
      <path d="M58 150 a42 10 0 0 0 84 0" fill="none" stroke={OUTLINE} strokeWidth="1.5" opacity="0.4" />
      <rect x="62" y="100" width="76" height="40" fill={accent.fill} />
      <rect x="62" y="100" width="76" height="40" fill="none" stroke={OUTLINE} strokeWidth="2" />
      <ellipse cx="118" cy="50" rx="9" ry="3.5" fill={accent.deep} stroke={OUTLINE} strokeWidth="2" />
    </g>
  );
}

/** Powder and paste in a pail: destainers, sanitiser powder. */
function Pail({ accent }: ShapeProps) {
  return (
    <g>
      <path d="M48 118 a52 14 0 0 1 104 0" fill="none" stroke={OUTLINE} strokeWidth="2.5" opacity="0.35" />
      <path d="M62 72 h76 l-8 92 a6 6 0 0 1-6 6 H76 a6 6 0 0 1-6-6 z" fill="#f7fafb" stroke={OUTLINE} strokeWidth="2.5" strokeLinejoin="round" />
      <ellipse cx="100" cy="72" rx="38" ry="9" fill="#ffffff" stroke={OUTLINE} strokeWidth="2.5" />
      <path d="M66 108 h68 l-3 36 H69 z" fill={accent.fill} stroke={OUTLINE} strokeWidth="2" strokeLinejoin="round" />
    </g>
  );
}

/** Anything counted rather than measured: dispensers, cloths, refills. */
function Carton({ accent }: ShapeProps) {
  return (
    <g>
      <path d="M56 78 l44-18 44 18 v76 l-44 18 -44-18 z" fill="#f7fafb" stroke={OUTLINE} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M56 78 l44 18 44-18" fill="none" stroke={OUTLINE} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M100 96 v76" stroke={OUTLINE} strokeWidth="2.5" />
      {/* Label sits on the left face, so the pack size is set over that face rather than over the fold. */}
      <path d="M62 112 h34 v28 H62 z" fill={accent.fill} opacity="0.92" />
      <rect x="62" y="112" width="34" height="28" fill="none" stroke={OUTLINE} strokeWidth="1.5" />
    </g>
  );
}
