"use server";

import { headers } from "next/headers";
import { getLeadRateLimiter } from "@/lib/rate-limit";
import { flagEnabled } from "@/lib/flags";
import { advise, type AdvisorResult } from "./service";

/**
 * The advisor is a server action, never a public API route: it spends money per call, so it must not
 * be something anyone can point a script at. The flag is re-checked here rather than trusted from the
 * page — a hidden form is not access control.
 */
export async function askAdvisorAction(question: string, contact: { name?: string; email?: string; phone?: string }): Promise<AdvisorResult> {
  if (!(await flagEnabled("advisor.enabled"))) {
    return { kind: "unavailable", message: "The advisor is not available. Tell us what you are cleaning and a person will answer." };
  }
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = await getLeadRateLimiter().limit(`advisor:${ip}`);
  if (!limit.ok) {
    return { kind: "unavailable", message: `That is a lot of questions at once. Try again in ${Math.ceil(limit.retryAfterSeconds / 60) || 1} minute${limit.retryAfterSeconds > 60 ? "s" : ""}, or send them to us in one message.` };
  }
  return advise(question, contact);
}
