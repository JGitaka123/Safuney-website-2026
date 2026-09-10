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
  /** Shown where the price would be when the pack is quoted rather than priced online. */
  priceNote?: string;
  hazard?: HazardClass;
  /** One line about what the product is for; clamped to two lines. */
  description?: string;
  /** Small line above the name, e.g. the range the product belongs to. */
  eyebrow?: string;
  /** Photo slot. Without it the tile is a flat ground-deep square carrying the product name (plan §8). */
  image?: ReactNode;
  /** The card's button, e.g. Add to cart or Get a price. */
  action?: ReactNode;
  /** Heading level for the product name; 3 under a section h2. */
  headingLevel?: 2 | 3 | 4;
  className?: string;
}

/**
 * Listing card (plan §4.6, restyled in ADR 0017): the pack on a white stage with the zone band along its
 * foot, then the name, one line of use, pack sizes and the price or "Price on request". The name link
 * covers the whole card; the action button sits above it and stays separately clickable.
 */
export function ProductCard({ name, href, zones = [], packs = [], priceLabel, priceNote, hazard = "NONE", description, eyebrow, image, action, headingLevel = 3, className }: ProductCardProps) {
  const Heading = `h${headingLevel}` as const;
  const multiPack = packs.length > 1;
  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card transition duration-200",
        "hover:-translate-y-0.5 hover:border-stainless hover:shadow-lift motion-reduce:transform-none",
        className,
      )}
    >
      <div className="bg-stage relative aspect-square overflow-hidden">
        {image ?? (
          <div aria-hidden className="grid h-full w-full place-items-center bg-ground-deep p-4">
            <span className="line-clamp-5 text-center text-h4 text-ink [overflow-wrap:anywhere]">{name}</span>
          </div>
        )}
        <ZoneBand zones={zones} className="absolute inset-x-0 bottom-0" />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {eyebrow ? <p className="text-caption text-ink-muted">{eyebrow}</p> : null}
        <Heading className="text-h4 text-ink">
          <a href={href} className="after:absolute after:inset-0 after:content-[''] hover:underline hover:underline-offset-[3px] focus-visible:underline">
            {name}
          </a>
        </Heading>
        {description ? <p className="line-clamp-2 text-small text-ink-muted">{description}</p> : null}
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
        ) : priceNote ? (
          <p className="text-small font-medium text-ink">{priceNote}</p>
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
