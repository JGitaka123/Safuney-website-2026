import { availabilityFor } from "@/lib/catalogue/availability";
import { flagEnabled } from "@/lib/flags";

/**
 * The stock and delivery line under the pack selector. Renders nothing at all when the feature is off
 * or when we have nothing honest to say, rather than showing a hedge.
 */
export async function AvailabilityNote({ variantId }: { variantId: string }) {
  if (!(await flagEnabled("liveStock.enabled"))) return null;
  const availability = await availabilityFor(variantId);
  if (!availability) return null;
  return (
    <p className="mt-3 text-small text-ink" data-testid="availability">
      <span className={availability.available > 0 ? "font-medium" : "text-ink-muted"}>{availability.label}</span>
      {availability.eta ? <span className="mt-1 block text-caption text-ink-muted">{availability.eta}</span> : null}
    </p>
  );
}
