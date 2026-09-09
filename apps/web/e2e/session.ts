import { join } from "node:path";

/** The demo staff accounts the seed creates, one per desk. */
export const STAFF_ROLES = ["admin", "sales", "finance", "warehouse"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const STAFF_PASSWORD = process.env["DEMO_STAFF_PASSWORD"] ?? "safuney-demo-2026";

/**
 * Where the setup project writes each role's signed-in state, and where specs read it.
 *
 * Inside the test directory rather than a temp folder so it is the same path for every worker and
 * every project: the sessions are written once per run, not once per worker.
 */
export function staffSessionPath(role: string): string {
  return join(__dirname, ".auth", `${role}.json`);
}
