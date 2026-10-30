import type { UserRole } from "@safuney/db";

export interface Desk {
  href: string;
  label: string;
  roles: readonly UserRole[];
}

/**
 * The staff desks, each with the roles its page admits (keep in step with the requireRole call on the
 * page). One list, so the menu never shows someone a desk that would turn them away. Rep visits are
 * left out: that page also depends on a feature switch.
 */
export const DESKS: readonly Desk[] = [
  { href: "/warehouse", label: "Warehouse board", roles: ["WAREHOUSE", "ADMIN"] },
  { href: "/sales", label: "Sales desk", roles: ["SALES", "ADMIN"] },
  { href: "/sales/credit", label: "Credit applications", roles: ["FINANCE", "ADMIN"] },
  { href: "/admin", label: "Admin console", roles: ["SALES", "WAREHOUSE", "FINANCE", "ADMIN"] },
];

export function desksFor(role: UserRole): Desk[] {
  return DESKS.filter((d) => d.roles.includes(role));
}

/**
 * Where a staff member lands after signing in. Finance works mostly in the admin console's orders
 * (invoices, payments, credit notes); administrators start from its overview.
 */
const HOME: Partial<Record<UserRole, string>> = { WAREHOUSE: "/warehouse", SALES: "/sales", FINANCE: "/admin", ADMIN: "/admin" };

export function homeDesk(role: UserRole): string {
  return HOME[role] ?? "/account";
}
