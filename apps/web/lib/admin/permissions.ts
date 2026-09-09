/**
 * Who may do what in the admin console.
 *
 * Permissions, not roles, are what actions declare. A role is a bundle of permissions, so adding a
 * role later (a stock clerk who may not touch prices, say) does not mean editing every action.
 */
import type { UserRole } from "@safuney/db";

export const PERMISSIONS = [
  "dashboard.view",
  "catalogue.view",
  "catalogue.write",
  "orders.view",
  "orders.write",
  "payments.write",
  "invoices.write",
  "customers.view",
  "customers.write",
  "credit.decide",
  "content.write",
  "merchandising.write",
  "reviews.moderate",
  "leads.view",
  "audit.view",
  "staff.write",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const SALES: Permission[] = ["dashboard.view", "catalogue.view", "orders.view", "customers.view", "customers.write", "leads.view"];
const WAREHOUSE: Permission[] = ["dashboard.view", "catalogue.view", "orders.view", "orders.write"];
const FINANCE: Permission[] = ["dashboard.view", "orders.view", "customers.view", "credit.decide", "payments.write", "invoices.write", "audit.view"];

/** ADMIN gets everything; the others get what their desk needs and nothing more. */
export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  CUSTOMER: [],
  B2B_BUYER: [],
  B2B_APPROVER: [],
  SALES,
  WAREHOUSE,
  FINANCE,
  ADMIN: PERMISSIONS,
};

export function can(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
