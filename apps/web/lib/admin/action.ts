/**
 * One seam for every admin mutation.
 *
 * Phase 6's gate says each admin mutation needs an authorisation test and an audit-log test. Writing
 * those per route means one of them eventually gets forgotten. Instead every mutation is declared
 * here: the seam checks the permission, runs the handler, and writes the `AuditLog` row itself, and
 * the registry lets one test iterate all of them and assert that the wrong roles are refused.
 */
import { headers } from "next/headers";
import { db, type UserRole } from "@safuney/db";
import { viewer, type Viewer } from "@/lib/auth/session";
import { can, type Permission } from "./permissions";

export type AdminResult = { ok: true; message?: string; id?: string } | { ok: false; message: string };

/** Thrown by handlers for a problem the operator can fix; the message is shown to them verbatim. */
export class AdminError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminError";
  }
}

export interface AuditRecord {
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}

export interface AdminContext {
  who: Viewer;
  /** What to record about this change. A handler that changes nothing may leave it alone. */
  audit: (record: AuditRecord) => void;
}

export interface AdminAction<A extends unknown[]> {
  name: string;
  permission: Permission;
  entity: string;
  run: (...args: A) => Promise<AdminResult>;
}

const registry = new Map<string, { permission: Permission; entity: string }>();

/** Every declared action, for the authorisation test to iterate. */
export function registeredActions(): Array<{ name: string; permission: Permission; entity: string }> {
  return [...registry.entries()].map(([name, v]) => ({ name, ...v }));
}

/** JSON with bigints written as strings — money is bigint everywhere and `JSON.stringify` throws on it. */
function jsonSafe(value: unknown): unknown {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
}

async function callerIp(): Promise<string | null> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    return forwarded ? (forwarded.split(",")[0]?.trim() ?? null) : null;
  } catch {
    return null; // Outside a request (a test calling the action directly).
  }
}

/**
 * Declares an admin mutation. The returned function is what routes and forms call.
 *
 * The audit row is written after the handler succeeds, in the same request, with whatever the handler
 * recorded. A handler that throws writes nothing: a refused or failed change is not a change.
 */
export function adminAction<A extends unknown[]>(
  name: string,
  permission: Permission,
  entity: string,
  handler: (ctx: AdminContext, ...args: A) => Promise<AdminResult>,
): (...args: A) => Promise<AdminResult> {
  registry.set(name, { permission, entity });
  return async (...args: A): Promise<AdminResult> => {
    const who = await viewer();
    if (!who || !can(who.role, permission)) {
      return { ok: false, message: "You do not have permission to do that." };
    }
    let record: AuditRecord | null = null;
    let result: AdminResult;
    try {
      result = await handler({ who, audit: (r) => { record = r; } }, ...args);
    } catch (e) {
      if (e instanceof AdminError) return { ok: false, message: e.message };
      console.error(`admin action ${name} failed`, e);
      return { ok: false, message: "Something went wrong on our side. Nothing was changed; try again." };
    }
    if (!result.ok) return result;
    const audited: AuditRecord = record ?? { entity };
    await db().auditLog.create({
      data: {
        actorId: who.id,
        action: name,
        entity: audited.entity || entity,
        entityId: audited.entityId ?? result.id ?? null,
        before: jsonSafe(audited.before) as never,
        after: jsonSafe(audited.after) as never,
        ip: await callerIp(),
      },
    });
    return result;
  };
}

/** Roles that can reach the console at all — the shell redirects everyone else. */
export const ADMIN_ROLES: UserRole[] = ["SALES", "WAREHOUSE", "FINANCE", "ADMIN"];
