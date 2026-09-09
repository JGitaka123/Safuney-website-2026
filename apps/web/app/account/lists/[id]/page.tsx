import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db, money } from "@safuney/db";
import { Input } from "@safuney/ui";
import { requireViewer } from "@/lib/auth/session";
import { ListError, SavedListService } from "@/lib/b2b/lists";
import { renameListAction } from "@/lib/b2b/list-actions";
import { AccountNav } from "@/components/account/account-nav";
import { ActionForm } from "@/components/account/action-form";
import { ListEditor } from "@/components/account/list-editor";

export const metadata: Metadata = { title: "Saved list", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const who = await requireViewer(`/account/lists/${id}`);
  let list;
  try {
    list = await new SavedListService(db()).get(who.id, id);
  } catch (e) {
    if (e instanceof ListError) notFound();
    throw e;
  }
  const organisation = who.memberships.some((m) => m.customer.type === "ORGANISATION");
  const lines = list.items.map((i) => ({
    variantId: i.variantId,
    name: i.variant.product.name,
    packLabel: i.variant.packLabel,
    qty: i.qty,
    href: `/products/${i.variant.product.category.slug}/${i.variant.product.slug}`,
    priceLabel: i.variant.priceMinorUnits > 0n ? money.formatKes(i.variant.priceMinorUnits) : null,
    available: i.variant.isActive && i.variant.product.isActive && !i.variant.product.needsPoReview,
    stock: i.variant.isMadeToOrder ? null : i.variant.stockOnHand - i.variant.stockReserved,
  }));
  return (
    <div className="mx-auto max-w-page px-5 py-8 md:px-6 md:py-12">
      <h1 className="text-h1">{list.name}</h1>
      <AccountNav current="/account/lists" organisation={organisation} />
      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        <section className="min-w-0 lg:col-span-8">
          <ListEditor listId={list.id} lines={lines} />
        </section>
        <aside className="min-w-0 lg:col-span-4">
          <ActionForm action={renameListAction.bind(null, list.id)} submitLabel="Rename" className="border border-line bg-surface p-5">
            <Input name="name" label="List name" defaultValue={list.name} required maxLength={60} />
          </ActionForm>
        </aside>
      </div>
    </div>
  );
}
