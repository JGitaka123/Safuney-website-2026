import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@safuney/db";
import { Table, TBody, Td, Th, THead, Tr } from "@safuney/ui";
import { viewer } from "@/lib/auth/session";
import { can } from "@/lib/admin/permissions";

export const metadata: Metadata = { title: "Audit log" };

/** A change as one line: "price_kes 1250.00 → 1400.00". Long values are trimmed, not hidden. */
function summarise(before: unknown, after: unknown): string {
  if (after === null || after === undefined) return "—";
  const a = after as Record<string, unknown>;
  const b = (before ?? {}) as Record<string, unknown>;
  const parts = Object.entries(a).map(([k, v]) => {
    const from = b[k];
    const to = String(v ?? "");
    return from === undefined ? `${k} ${to}` : `${k} ${String(from ?? "")} → ${to}`;
  });
  const text = parts.join(" · ");
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ entity?: string }> }) {
  const who = await viewer();
  if (!who || !can(who.role, "audit.view")) redirect("/account?denied=1");
  const entity = ((await searchParams).entity ?? "").trim();
  const rows = await db().auditLog.findMany({
    where: entity ? { entity } : {},
    include: { actor: { select: { name: true, email: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div>
      <h1 className="text-h1">Audit log</h1>
      <p className="mt-2 max-w-reading text-body text-ink-muted">
        Every change made through the console, with who made it and what it was before. Append-only: nothing here can
        be edited or removed from the console.
      </p>
      <form className="mt-5 flex flex-wrap items-end gap-3" action="/admin/audit">
        <label className="text-caption text-ink-muted">
          <span className="block">Entity</span>
          <input name="entity" defaultValue={entity} placeholder="Product, Invoice, Lead…" className="mt-1 min-h-11 border border-line bg-surface px-3 text-body text-ink" />
        </label>
        <button type="submit" className="min-h-11 border border-stainless bg-surface px-4 text-body text-ink hover:border-ink">
          Filter
        </button>
      </form>

      <div className="mt-5">
        <Table caption="Changes made through the admin console">
          <THead>
            <Tr>
              <Th>When</Th>
              <Th>Who</Th>
              <Th>Action</Th>
              <Th>What changed</Th>
            </Tr>
          </THead>
          <TBody>
            {rows.map((r) => (
              <Tr key={r.id}>
                <Td className="whitespace-nowrap text-caption">{r.createdAt.toISOString().replace("T", " ").slice(0, 16)}</Td>
                <Td>
                  {r.actor?.name ?? r.actor?.email ?? "—"}
                  {r.actor ? <span className="mt-1 block text-caption text-ink-muted">{r.actor.role.toLowerCase()}</span> : null}
                </Td>
                <Td className="font-mono text-caption">{r.action}</Td>
                <Td className="text-caption">{summarise(r.before, r.after)}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </div>
      {rows.length === 0 ? <p className="mt-4 text-body text-ink-muted">Nothing recorded yet.</p> : null}
    </div>
  );
}
