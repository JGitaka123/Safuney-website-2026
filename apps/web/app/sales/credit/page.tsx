import type { Metadata } from "next";
import Link from "next/link";
import { db, money } from "@safuney/db";
import { Input, Select, Textarea } from "@safuney/ui";
import { requireRole } from "@/lib/auth/session";
import { decideCreditAction } from "@/lib/b2b/credit-actions";
import { ActionForm } from "@/components/account/action-form";

export const metadata: Metadata = { title: "Credit applications", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SalesCreditPage() {
  await requireRole(["FINANCE", "ADMIN"], "/sales/credit");
  const pending = await db().creditApplication.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, include: { customer: { include: { members: { where: { role: "OWNER" }, include: { user: { select: { name: true, email: true, phone: true } } } } } } } });
  return (
    <div className="mx-auto max-w-page px-5 py-8 md:px-6 md:py-12">
      <p className="text-small text-ink-muted">
        <Link href="/sales" className="hover:underline underline-offset-[3px]">
          Sales desk
        </Link>
      </p>
      <h1 className="mt-1 text-h1">Credit applications</h1>
      {pending.length === 0 ? (
        <p className="mt-6 text-body text-ink-muted">Nothing waiting. New applications from organisation owners appear here.</p>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {pending.map((a) => {
            const refs = a.tradeReferences as Array<{ company: string; contact: string; phone: string }>;
            const docs = a.documents as Array<{ name: string; fileUrl: string }>;
            return (
              <article key={a.id} className="border border-line bg-surface p-5">
                <h2 className="text-h3">{a.legalName}</h2>
                <p className="text-small text-ink-muted">
                  {a.customer.displayName} · KRA PIN <span className="font-mono">{a.kraPin}</span> · asked for {money.formatKes(a.requestedLimitMinorUnits)} on {a.requestedTermsDays}-day terms
                </p>
                <p className="mt-1 text-small text-ink-muted">Owner: {a.customer.members.map((m) => `${m.user.name ?? ""} ${m.user.email ?? ""} ${m.user.phone ?? ""}`.trim()).join("; ")}</p>
                <ul className="mt-3 text-small text-ink">
                  {refs.map((r, i) => (
                    <li key={i}>
                      Reference: {r.company}
                      {r.contact ? `, ${r.contact}` : ""} · <span className="tabular-nums">{r.phone}</span>
                    </li>
                  ))}
                  {docs.map((d, i) => (
                    <li key={`d${i}`}>
                      Document:{" "}
                      <a href={d.fileUrl} className="text-accent underline underline-offset-[3px]" rel="noreferrer">
                        {d.name}
                      </a>
                    </li>
                  ))}
                </ul>
                <ActionForm action={decideCreditAction.bind(null, a.id)} submitLabel="Record the decision" className="mt-4 border-t border-line pt-4">
                  <Select name="decision" label="Decision" defaultValue="approve">
                    <option value="approve">Approve</option>
                    <option value="reject">Do not approve</option>
                  </Select>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input name="limit" label="Approved limit (KES)" defaultValue={money.formatKes(a.requestedLimitMinorUnits).replace(/^KES\s/, "")} inputMode="decimal" />
                    <Select name="termsDays" label="Terms" defaultValue={String(a.requestedTermsDays)}>
                      {[14, 30, 45, 60].map((d) => (
                        <option key={d} value={d}>
                          {d} days
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Textarea name="note" label="Note to the customer" optional rows={2} />
                </ActionForm>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
