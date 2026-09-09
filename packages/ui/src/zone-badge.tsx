import { cn } from "./cn";
import { zoneMeta, type ZoneKey } from "./zone";

export interface ZoneBadgeProps {
  zone: ZoneKey;
  className?: string;
}

/** 8 px swatch + zone word on a surface pill (plan §6.6). Colour is never the only carrier. */
export function ZoneBadge({ zone, className }: ZoneBadgeProps) {
  const meta = zoneMeta(zone);
  if (!meta) return null;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-chip border border-line bg-surface px-2 py-1 text-label text-ink", className)}>
      <span aria-hidden className={cn("size-2 shrink-0", meta.swatch)} />
      {meta.label}
    </span>
  );
}

export interface ZoneBandProps {
  zones: readonly ZoneKey[];
  className?: string;
  /** Adds the one-time fill animation (home page only). */
  animate?: boolean;
  animationDelayMs?: number;
}

/** The 6 px band under a product photo; splits into equal segments for multi-zone products. */
export function ZoneBand({ zones, className, animate, animationDelayMs = 0 }: ZoneBandProps) {
  const metas = zones.map(zoneMeta).filter((z): z is NonNullable<typeof z> => Boolean(z));
  if (metas.length === 0) return null;
  return (
    <div className={cn("flex h-1.5 w-full", className)} role="img" aria-label={`Use in: ${metas.map((m) => m.label).join(", ")}`}>
      {metas.map((m, i) => (
        <span
          key={m.key}
          className={cn("h-full flex-1", m.swatch, animate && "zone-band-animate")}
          style={animate ? { animationDelay: `${animationDelayMs + i * 80}ms` } : undefined}
        />
      ))}
    </div>
  );
}
