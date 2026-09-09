import Link from "next/link";
import { ZONES, cn, type ZoneKey } from "@safuney/ui";

interface ZoneBarProps {
  counts: Partial<Record<ZoneKey, number>> | null;
  /** One-time fill animation on the home page (plan §5). */
  animate?: boolean;
}

/** "Where will you use it?" — the four colour-coded zones as navigation (plan §4.1, §4.3). */
export function ZoneBar({ counts, animate }: ZoneBarProps) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {ZONES.map((zone, i) => {
        const count = counts?.[zone.key];
        return (
          <li key={zone.key}>
            <Link
              href={`/products?zone=${zone.slug}`}
              className="group flex min-h-16 items-stretch gap-4 border border-line bg-surface hover:border-stainless lg:min-h-0 lg:flex-col lg:gap-0"
            >
              <span aria-hidden className="w-2 shrink-0 overflow-hidden lg:h-3 lg:w-full">
                <span
                  className={cn("block h-full w-full", zone.swatch, animate && "zone-band-animate")}
                  style={animate ? { animationDelay: `${120 + i * 80}ms` } : undefined}
                />
              </span>
              <span className="flex flex-1 items-center justify-between gap-3 py-3 pr-4 lg:px-4 lg:py-4">
                <span>
                  <span className="block text-h4 text-ink">{zone.label}</span>
                  <span className="block text-small text-ink-muted">{zone.meaning}</span>
                </span>
                {typeof count === "number" && count > 0 ? (
                  <span className="tnum shrink-0 text-small text-ink-muted">{count} products</span>
                ) : null}
                <svg aria-hidden className="shrink-0 text-stainless lg:hidden" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 3l5 5-5 5" />
                </svg>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
