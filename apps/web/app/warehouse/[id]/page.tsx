import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { money } from "@safuney/db";
import { Input, Table, TBody, Td, Th, THead, Tr } from "@safuney/ui";
import { requireRole } from "@/lib/auth/session";
import { orderService } from "@/lib/orders/context";
import { OrderError } from "@/lib/orders/service";
import { dispatchAction, markDeliveredAction, markPackedAction, recordCodAction } from "@/lib/warehouse/actions";
import { ActionForm } from "@/components/account/action-form";
import { PackedButton } from "@/components/warehouse/packed-button";

export const metadata: Metadata = { title: "Pick list", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function WarehouseOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const who = await requireRole(["WAREHOUSE", "ADMIN"], `/warehouse/${id}`);
  let pick;
  try {
    pick = await orderService().pickList(id, who.id);
  } catch (e) {
    if (e instanceof OrderError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const { order, lines } = pick;
  const shipping = order.shippingAddress as { recipientName?: string; recipientPhone?: string; county?: string; town?: string; line1?: string; landmark?: string; deliveryNotes?: string } | null;
  const billing = order.billingAddress as { name?: string; phone?: string } | null;
  const codDone = order.fulfilment?.codCollectedMinorUnits !== null && order.fulfilment?.codCollectedMinorUnits !== undefined;

  return (
    <div className="mx-auto max-w-page px-5 py-8 md:px-6 md:py-12">
      <p className="text-small text-ink-muted">
        <Link href="/warehouse" className="hover:underline underline-offset-[3px]">
          Warehouse
        </Link>
      </p>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h1 className="font-mono text-h1">{order.number}</h1>
        <p className="text-body text-ink">{order.status === "PAID" ? "Paid, to pick" : order.status === "CONFIRMED" ? (order.paymentMethod === "COD" ? "Cash on delivery, to pick" : "Invoice, to pick") : order.status === "PACKED" ? "Packed" : order.status === "DISPATCHED" ? "Out for delivery" : order.status === "DELIVERED" ? "Delivered" : order.status.toLowerCase()}</p>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        <section className="min-w-0 lg:col-span-7">
          <h2 className="text-h3">Pick list</h2>
          <div className="mt-3">
            <Table caption={`Pick list for ${order.number}`}>
              <THead>
                <Tr>
                  <Th>SKU</Th>
                  <Th>Item</Th>
                  <Th numeric>Qty</Th>
                  <Th>Picked</Th>
                </Tr>
              </THead>
              <TBody>
                {lines.map((l) => (
                  <Tr key={l.sku}>
                    <Td className="font-mono">{l.sku}</Td>
                    <Td>
                      {l.name} <span className="text-ink-muted">{l.packLabel}</span>
                    </Td>
                    <Td className="text-right tabular-nums">{l.qty}</Td>
                    <Td>
                      <span aria-hidden className="inline-block size-5 border border-stainless print:border-ink" />
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </div>
          <p className="mt-4 text-small text-ink-muted print:hidden">Print this page for the picker (Ctrl+P); the tick boxes print with the list.</p>

          <h2 className="mt-8 text-h3">{order.deliveryMethod === "PICKUP" ? "Collection" : "Delivery"}</h2>
          {order.deliveryMethod === "PICKUP" ? (
            <p className="mt-2 text-body text-ink">
              Collected by {billing?.name ?? order.guestEmail} · <span className="tabular-nums">{billing?.phone ?? order.guestPhone}</span>
            </p>
          ) : (
            <p className="mt-2 text-body text-ink">
              {shipping?.recipientName ?? billing?.name} · <span className="tabular-nums">{shipping?.recipientPhone ?? billing?.phone}</span>
              <br />
              {[shipping?.line1, shipping?.landmark ? `near ${shipping.landmark}` : null, shipping?.town, shipping?.county].filter(Boolean).join(", ")}
              {shipping?.deliveryNotes ? <span className="block text-small text-ink-muted">{shipping.deliveryNotes}</span> : null}
              {order.deliverySlot ? <span className="block text-small text-ink-muted">Slot: {order.deliverySlot}</span> : null}
            </p>
          )}
          {order.notes ? <p className="mt-2 text-small text-ink-muted">Customer note: {order.notes}</p> : null}
          {order.paymentMethod === "COD" ? (
            <p className="mt-2 text-body font-medium text-ink">
              Collect {money.formatKes(order.totalMinorUnits)} in cash or M-Pesa.{codDone ? ` Recorded: ${money.formatKes(order.fulfilment!.codCollectedMinorUnits!)}${order.fulfilment?.codMpesaRef ? ` (${order.fulfilment.codMpesaRef})` : ""}.` : ""}
            </p>
          ) : null}
        </section>

        <aside className="min-w-0 lg:col-span-5 print:hidden">
          {order.status === "PAID" || order.status === "CONFIRMED" ? <PackedButton orderId={order.id} action={markPackedAction} /> : null}
          {order.status === "PACKED" ? (
            <ActionForm action={dispatchAction.bind(null, order.id)} submitLabel="Mark dispatched" busyLabel="Dispatching…" className="border border-line bg-surface p-5">
              <Input name="riderName" label="Rider" required defaultValue={order.fulfilment?.riderName ?? ""} />
              <Input name="riderPhone" label="Rider's phone" optional type="tel" defaultValue={order.fulfilment?.riderPhone ?? ""} helper="Sent to the customer with the dispatch message." />
            </ActionForm>
          ) : null}
          {order.status === "DISPATCHED" ? (
            <ActionForm action={markDeliveredAction.bind(null, order.id)} submitLabel="Mark delivered" busyLabel="Saving…" className="border border-line bg-surface p-5">
              <Input name="podName" label="Received by (name)" required />
              <Input name="podPhotoUrl" label="Proof-of-delivery photo link" optional helper="Uploads arrive with the admin console; a photo link is fine for now." />
            </ActionForm>
          ) : null}
          {order.paymentMethod === "COD" && (order.status === "DISPATCHED" || order.status === "DELIVERED") && !codDone ? (
            <ActionForm action={recordCodAction.bind(null, order.id)} submitLabel="Record collection" className="mt-6 border border-line bg-surface p-5">
              <Input name="amount" label="Amount collected (KES)" required inputMode="decimal" defaultValue={money.formatKes(order.totalMinorUnits).replace(/^KES\s/, "")} />
              <Input name="mpesaRef" label="M-Pesa reference" optional className="font-mono uppercase" helper="Leave empty for cash." />
            </ActionForm>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
