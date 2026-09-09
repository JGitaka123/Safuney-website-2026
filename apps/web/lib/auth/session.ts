import { cache } from "react";
import { redirect } from "next/navigation";
import { db, type UserRole } from "@safuney/db";
import { auth } from "@/auth";

export interface Viewer {
  id: string;
  role: UserRole;
  name: string | null;
  email: string | null;
  phone: string | null;
  /** Organisation memberships (an individual customer has one implicit customer record, see ensureCustomer). */
  memberships: Array<{ customerId: string; role: "OWNER" | "BUYER" | "APPROVER"; customer: { id: string; displayName: string; type: "INDIVIDUAL" | "ORGANISATION"; status: string } }>;
}

/** The signed-in user with what the account pages need, or null. Cached per request. */
export const viewer = cache(async (): Promise<Viewer | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await db().user.findUnique({
    where: { id },
    select: { id: true, role: true, name: true, email: true, phone: true, isActive: true, memberships: { select: { customerId: true, role: true, customer: { select: { id: true, displayName: true, type: true, status: true } } } } },
  });
  if (!user || !user.isActive) return null;
  return { id: user.id, role: user.role, name: user.name, email: user.email, phone: user.phone, memberships: user.memberships };
});

/** Redirects to sign-in (with a return path) when there is no session. */
export async function requireViewer(next: string): Promise<Viewer> {
  const v = await viewer();
  if (!v) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  return v;
}

const STAFF: UserRole[] = ["SALES", "WAREHOUSE", "FINANCE", "ADMIN"];

export function isStaff(role: UserRole): boolean {
  return STAFF.includes(role);
}

export async function requireRole(roles: UserRole[], next: string): Promise<Viewer> {
  const v = await requireViewer(next);
  if (!roles.includes(v.role)) redirect("/account?denied=1");
  return v;
}
