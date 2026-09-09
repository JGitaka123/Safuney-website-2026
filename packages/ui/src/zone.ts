/** Colour-coded cleaning zones (plan §2.2). The word always accompanies the colour. */
export type ZoneKey = "RED" | "BLUE" | "GREEN" | "YELLOW";

export interface ZoneMeta {
  key: ZoneKey;
  /** Sentence-case label used everywhere the zone is written. */
  label: string;
  /** Short description for filters and the guide. */
  meaning: string;
  /** Tailwind class for the swatch/band fill. */
  swatch: string;
  /** Tailwind class for the zone word when written on white. */
  text: string;
  /** Tailwind class for text placed on the swatch. */
  onSwatch: string;
  slug: string;
}

export const ZONES: readonly ZoneMeta[] = [
  { key: "RED", label: "Washrooms", meaning: "Toilets, washrooms and sanitary areas", swatch: "bg-zone-red", text: "text-zone-red", onSwatch: "text-white", slug: "washrooms" },
  { key: "BLUE", label: "General areas", meaning: "Floors, corridors, offices and public areas", swatch: "bg-zone-blue", text: "text-zone-blue", onSwatch: "text-white", slug: "general-areas" },
  { key: "GREEN", label: "Kitchen and food prep", meaning: "Kitchens, food preparation and food-contact surfaces", swatch: "bg-zone-green", text: "text-zone-green", onSwatch: "text-white", slug: "kitchen" },
  { key: "YELLOW", label: "Clinical and isolation", meaning: "Clinical, isolation and infection-control areas", swatch: "bg-zone-yellow", text: "text-zone-yellow-ink", onSwatch: "text-ink", slug: "clinical" },
] as const;

export function zoneMeta(key: string | null | undefined): ZoneMeta | undefined {
  return ZONES.find((z) => z.key === key || z.slug === key);
}
