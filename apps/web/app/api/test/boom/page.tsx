import { notFound } from "next/navigation";
import { authMockMode } from "@/lib/auth/mode";

export const dynamic = "force-dynamic";

/**
 * Throws, so the branded error boundary can be tested for real rather than assumed.
 *
 * Gated on mock mode exactly like the other test-only routes, so it does not exist in production —
 * a route whose entire purpose is to fail is not something to leave reachable on a live shop.
 */
export default async function Boom() {
  if (!authMockMode()) notFound();
  throw new Error("Deliberate failure, for testing the error page.");
}
