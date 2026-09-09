import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@safuney/db";
import { Input } from "@safuney/ui";
import { requireViewer } from "@/lib/auth/session";
import { SavedListService } from "@/lib/b2b/lists";
import { createListAction } from "@/lib/b2b/list-actions";
import { AccountNav } from "@/components/account/account-nav";
import { ActionForm } from "@/components/account/action-form";

export const metadata: Metadata = { title: "Saved lists", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ListsPage() {
  const who = await requireViewer("/account/lists");
  const lists = await new SavedListService(db()).listsFor(who.id);
  const organisation = who.memberships.some((m) => m.customer.type === "ORGANISATION");
  return (
    <div className="mx-auto max-w-page px-5 py-8 md:px-6 md:py-12">
      <h1 className="text-h1">Saved lists</h1>
      <AccountNav current="/account/lists" organisation={organisation} />
      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        <section aria-labelledby="lists-heading" className="min-w-0 lg:col-span-7">
          <h2 id="lists-heading" className="sr-only">
            Your lists
          </h2>
          {lists.length === 0 ? (
            <p className="text-body text-ink-muted">A list is a standing order you add to the cart in one tap: the weekly kitchen order, the monthly housekeeping top-up. Create one here, or save any order as a list from your order history.</p>
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {lists.map((l) => (
                <li key={l.id} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-4">
                  <Link href={`/account/lists/${l.id}`} className="text-body font-medium text-ink underline-offset-[3px] hover:underline">
                    {l.name}
                  </Link>
                  <span className="text-small tabular-nums text-ink-muted">
                    {l.items.length} line{l.items.length === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <aside className="min-w-0 lg:col-span-5">
          <ActionForm action={createListAction} submitLabel="Create list" busyLabel="Creating…" className="border border-line bg-surface p-5">
            <Input name="name" label="New list" placeholder="Weekly kitchen order" required maxLength={60} />
          </ActionForm>
        </aside>
      </div>
    </div>
  );
}
