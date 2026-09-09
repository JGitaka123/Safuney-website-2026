import type { ReactNode } from "react";
import { cn } from "./cn";
import { HazardBadge, type HazardClass } from "./hazard-badge";
import { PackChip } from "./pack-chip";
import { ZoneBand } from "./zone-badge";
import type { ZoneKey } from "./zone";

export interface ProductCardProps {
  name: string;
  href: string;
  zones?: readonly ZoneKey[];
  /** Pack sizes as written on the label, e.g. ["5 L", "20 L"]. */
  packs?: readonly string[];
  /** Lowest pack price, preformatted, e.g. "KES 1,250.00". Prefixed "From" only when there is more than one pack. */
  priceLabel?: string;
  hazard?: HazardClass;
  /** Photo slot. Without it the tile is a flat ground-deep square carrying the product name (plan §8). */
  image?: ReactNode;
  /** The card's button, e.g. Add to cart or Request a quote. */
  action?: ReactNode;
  /** Heading level for the product name; 3 under a section h2. */
  headingLevel?: 2 | 3 | 4;
  className?: string;
}

/**
 * Listing card (plan §4.6): photo on surface with a 1 px line frame, radius 0; the 6 px zone band sits flush
 * under the photo inside the frame; text below on bare ground with no border. Hover darkens the frame to
 * stainless — nothing lifts, nothing casts a shadow. The title link is the whole card's hit area.
 */
export function ProductCard({ name, href, zones = [], packs = [], priceLabel, hazard = "NONE", image, action, headingLevel = 3, className }: ProductCardProps) {
  const Heading = `h${headingLevel}` as const;
  const multiPack = packs.length > 1;
  return (
    <article className={cn("group relative flex flex-col", className)}>
      <div className="border border-line bg-surface transition-colors duration-120 group-hover:border-stainless motion-reduce:transition-none">
        <div className="aspect-square overflow-hidden">
          {image ?? (
            <div aria-hidden className="grid h-full w-full place-items-center bg-ground-deep p-4">
              <span className="line-clamp-5 text-center text-h4 text-ink [overflow-wrap:anywhere]">{name}</span>
            </div>
          )}
        </div>
        <ZoneBand zones={zones} />
      </div>
      <div className="flex flex-1 flex-col gap-2 pt-3">
        <Heading className="text-h4 text-ink">
          <a href={href} className="after:absolute after:inset-0 after:content-[''] hover:underline hover:underline-offset-[3px] focus-visible:underline">
            {name}
          </a>
        </Heading>
        {packs.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5" aria-label="Pack sizes">
            {packs.map((p) => (
              <li key={p}>
                <PackChip>{p}</PackChip>
              </li>
            ))}
          </ul>
        ) : null}
        {priceLabel ? (
          <p className="text-price text-ink tabular-nums">
            {multiPack ? <span className="text-small font-normal text-ink-muted">From </span> : null}
            {priceLabel}
          </p>
        ) : null}
        {hazard !== "NONE" ? (
          <div>
            <HazardBadge hazard={hazard} />
          </div>
        ) : null}
        {action ? <div className="relative z-10 mt-auto pt-2">{action}</div> : null}
      </div>
    </article>
  );
}
