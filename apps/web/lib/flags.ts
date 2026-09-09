/**
 * Feature flags for the Phase 8 features.
 *
 * Every flag defaults to **off**. A feature the PO has not seen demonstrated should not appear on the
 * live site because a deploy happened, and a flag that is off means the feature is unreachable rather
 * than merely unlinked — the route refuses, not just the navigation. A hidden link is not access
 * control, which is the same rule the admin console is tested against.
 */
import { cache } from "react";
import { db } from "@safuney/db";
import { services } from "./env";

export const FLAGS = {
  "advisor.enabled": "AI product advisor — describe a cleaning problem, get products from our catalogue",
  "planner.enabled": "Facility hygiene planner — consumption estimate, colour-coded kit and a schedule",
  "compliance.enabled": "Compliance hub — SDS and COA library with versions and update notifications",
  "subscriptions.enabled": "Auto-replenishment — repeat deliveries a customer can pause or skip",
  "pwa.enabled": "Installable app with offline product browsing",
  "reps.enabled": "Sales-rep mode — reps place orders for customers, with visit notes",
  "loyalty.enabled": "Volume tiers that unlock automatically, and an annual spend statement",
  "liveStock.enabled": "Live stock and delivery estimate on product pages",
} as const;

export type FlagKey = keyof typeof FLAGS;

/** Reads every flag once per request; a page checking three flags makes one query, not three. */
const allFlags = cache(async (): Promise<Set<string>> => {
  if (!services.database()) return new Set();
  try {
    const rows = await db().featureFlag.findMany({ where: { enabled: true }, select: { key: true } });
    return new Set(rows.map((r) => r.key));
  } catch (e) {
    // A database that is down must not switch features on; off is the safe direction.
    console.error("feature flags unavailable; treating all as off", e);
    return new Set();
  }
});

export async function flagEnabled(key: FlagKey): Promise<boolean> {
  return (await allFlags()).has(key);
}

/** For a page that shows several optional things at once. */
export async function flagsEnabled(): Promise<Record<FlagKey, boolean>> {
  const on = await allFlags();
  return Object.fromEntries(Object.keys(FLAGS).map((k) => [k, on.has(k)])) as Record<FlagKey, boolean>;
}
