import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Table, TBody, Td, Th, THead, Tr } from "@safuney/ui";
import { money } from "@safuney/db";
import { getOrder } from "@/lib/orders/queries";
import { statusMessage } from "@/lib/orders/service";
import { paymentsMode } from "@safuney/payments";
import { paymentRegistry } from "@/lib/orders/context";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { OrderActions } from "@/components/orders/order-actions";

export const dynamic = "force-dynamic";

interface OrderPageProps {
  params: Promise<{ number: string }>;
  searchParams: Promise<{ token?: string }>;
}

export async function generateMetadata({ params }: OrderPageProps): Promise<Metadata> {
  const { number } = await params;
  return {
    title: `Order ${number}`,
    robots: { index: false },
  };
}

function formatKenyaDate(date: Date): string {
  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Nairobi",
  }).format(date);
}

function eventTypeLabel(type: string, status: string | null): string {
  switch (type) {
    case "order_placed":
      return "Order submitted";
    case "payment_initiated":
      return status === "CONFIRMED" ? "Order confirmed" : "Payment request sent";
    case "payment_received":
      return "Payment confirmed";
    case "payment_failed":
      return "Payment failed";
    case "payment_cancelled":
      return "Payment cancelled";
    case "payment_method_changed":
      return "Payment method changed";
    case "reservation_released":
      return "Reservation expired";
    case "order_confirmed":
      return "Order confirmed";
    default:
      return type.replace(/_/g, " ");
  }
}

export default async function OrderDetailPage({ params, searchParams }: OrderPageProps) {
  const { number } = await params;
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="mx-auto max-w-page px-5 py-8 md:px-6 md:py-12">
        <Breadcrumbs items={[{ label: "Orders" }, { label: number }]} />
        <div className="mt-8 max-w-xl border border-line bg-surface p-6">
          <h1 className="text-h2 font-semibold text-ink">Access token required</h1>
          <p className="mt-3 text-body text-ink">
            To protect customer privacy, an order can only be viewed with the unique tracking link sent to your email or phone.
          </p>
          <p className="mt-2 text-small text-ink-muted">
            If you need assistance looking up this order, call +254 796 808 822 or email info@safuney.com.
          </p>
        </div>
      </div>
    );
  }

  const order = await getOrder(number, token);
  if (!order) {
    notFound();
  }

  const fmt = (m: bigint) => money.formatKes(m);
  const statusMsg = statusMessage(order.status, order.paymentMethod);
  const isSuccessful = order.status === "PAID" || order.status === "CONFIRMED" || order.status === "PACKED" || order.status === "DISPATCHED" || order.status === "DELIVERED";
  const isFailed = order.status === "PAYMENT_FAILED";

  const shipping = (order.shippingAddress ?? {}) as {
    recipientName?: string;
    phone?: string;
    county?: string;
    town?: string;
    line1?: string;
    landmark?: string;
    deliveryNotes?: string;
    label?: string;
  };

  const lastPayment = order.payments[0];

  return (
    <div className="mx-auto max-w-page px-4 py-8 md:px-6 md:py-12">
      <Breadcrumbs items={[{ label: "Orders" }, { label: order.number }]} />

      <div className="mt-6 flex flex-col justify-between gap-4 border-b border-line pb-6 md:flex-row md:flex-wrap md:items-end">
        <div>
          <p className="text-small font-medium text-accent">{order.status === "PAID" || order.status === "CONFIRMED" ? "Order confirmed" : order.status === "PENDING_PAYMENT" || order.status === "PAYMENT_FAILED" ? "Order saved, payment outstanding" : "Your order"}</p>
          <h1 className="mt-1 whitespace-nowrap font-mono text-h1 font-semibold text-ink">{order.number}</h1>
          <p className="mt-1 text-small text-ink-muted">
            Placed on <span className="tabular-nums">{formatKenyaDate(order.placedAt ?? order.createdAt)}</span>
          </p>
        </div>

        <OrderActions
          orderNumber={order.number}
          accessToken={order.accessToken}
          status={order.status}
          paymentMethod={order.paymentMethod}
          totalLabel={fmt(order.totalMinorUnits)}
          customerPhone={order.guestPhone}
          mockMode={paymentsMode() === "mock"}
          cardAvailable={paymentRegistry().CARD.isConfigured()}
          mpesaAvailable={paymentRegistry().MPESA.isConfigured()}
        />
      </div>

      {/* Status Alert Banner */}
      <div className="mt-6">
        {isSuccessful ? (
          <Alert variant="success" title="In progress">
            {statusMsg}
          </Alert>
        ) : isFailed ? (
          <Alert variant="error" title="Payment incomplete">
            {statusMsg}
          </Alert>
        ) : (
          <div className="border border-line bg-surface p-4 text-body text-ink">
            <span className="font-semibold text-accent">Status: </span>
            {statusMsg}
          </div>
        )}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        {/* Left Column: Items and event timeline */}
        <div className="flex min-w-0 flex-col gap-8 lg:col-span-8">
          {/* Items Section */}
          <section aria-labelledby="order-items-heading" className="border border-line bg-surface p-6">
            <h2 id="order-items-heading" className="text-h3 font-semibold text-ink">
              Items ordered
            </h2>

            {/* Small screens: one card per line; a five-column table would only scroll. */}
            <ul className="mt-4 divide-y divide-line border-y border-line md:hidden">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-4 py-3 text-small">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{item.name}</p>
                    <p className="break-all font-mono text-caption text-ink-muted">{item.sku}</p>
                    <p className="mt-1 tabular-nums text-ink-muted">
                      {item.packLabel} × {item.qty} at {fmt(item.unitPriceMinorUnits)}
                    </p>
                  </div>
                  <p className="shrink-0 font-medium tabular-nums text-ink">{fmt(item.lineTotalMinorUnits + item.lineVatMinorUnits)}</p>
                </li>
              ))}
            </ul>
            <div className="mt-4 hidden md:block">
              <Table caption="Items in this order">
                <THead>
                  <Tr>
                    <Th>Item</Th>
                    <Th>Pack size</Th>
                    <Th numeric>Unit price</Th>
                    <Th numeric>Qty</Th>
                    <Th numeric>Line total</Th>
                  </Tr>
                </THead>
                <TBody>
                  {order.items.map((item) => (
                    <Tr key={item.id}>
                      <Td>
                        <div className="font-medium text-ink">{item.name}</div>
                        <div className="break-all font-mono text-small text-ink-muted">{item.sku}</div>
                      </Td>
                      <Td className="tabular-nums text-ink">{item.packLabel}</Td>
                      <Td className="text-right tabular-nums text-ink">{fmt(item.unitPriceMinorUnits)}</Td>
                      <Td className="text-right tabular-nums text-ink">{item.qty}</Td>
                      <Td className="text-right tabular-nums font-medium text-ink">
                        {fmt(item.lineTotalMinorUnits + item.lineVatMinorUnits)}
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </div>

            {/* Financial Summary */}
            <div className="mt-6 border-t border-line pt-4">
              <dl className="ml-auto flex max-w-xs flex-col gap-2 text-small text-ink">
                <div className="flex justify-between">
                  <dt className="text-ink-muted">Subtotal (ex VAT)</dt>
                  <dd className="tabular-nums font-medium">{fmt(order.subtotalMinorUnits)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-muted">VAT (16%)</dt>
                  <dd className="tabular-nums font-medium">{fmt(order.vatMinorUnits)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-muted">Delivery fee</dt>
                  <dd className="tabular-nums font-medium">{fmt(order.deliveryMinorUnits)}</dd>
                </div>
                <div className="flex justify-between border-t border-line pt-2 text-body font-semibold text-ink">
                  <dt>Total charged</dt>
                  <dd className="text-price tabular-nums">{fmt(order.totalMinorUnits)}</dd>
                </div>
              </dl>
            </div>
          </section>

          {/* Timeline of Order Events */}
          <section aria-labelledby="order-events-heading" className="border border-line bg-surface p-6">
            <h2 id="order-events-heading" className="text-h3 font-semibold text-ink">
              Order history & events
            </h2>

            <ol className="mt-4 divide-y divide-line">
              {order.events.map((evt) => (
                <li key={evt.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-3 text-small">
                  <span className="font-medium text-ink">{eventTypeLabel(evt.type, evt.status)}</span>
                  <time className="tabular-nums text-ink-muted" dateTime={evt.createdAt.toISOString()}>
                    {formatKenyaDate(evt.createdAt)}
                  </time>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* Right Column: Fulfilment and payment details */}
        <aside className="flex min-w-0 flex-col gap-6 lg:col-span-4">
          {/* Delivery Card */}
          <div className="border border-line bg-surface p-5">
            <h3 className="text-h4 font-semibold text-ink">Delivery details</h3>
            <div className="mt-3 text-small text-ink">
              {order.deliveryMethod === "PICKUP" ? (
                <div>
                  <p className="font-semibold">Self-collection</p>
                  <p className="mt-1 text-ink-muted">
                    Safuney Limited, Park View Heights, Mezzanine 3, Office A, Mombasa Road, Nairobi.
                  </p>
                </div>
              ) : (
                <div>
                  <p className="font-semibold">{shipping.recipientName || order.guestEmail}</p>
                  <p className="mt-1">
                    {shipping.town}, {shipping.county}
                  </p>
                  {shipping.line1 ? <p>{shipping.line1}</p> : null}
                  {shipping.landmark ? <p className="text-ink-muted">Landmark: {shipping.landmark}</p> : null}
                  {shipping.phone ? <p className="mt-1 tabular-nums text-ink-muted">Phone: {shipping.phone}</p> : null}
                  {order.deliverySlot ? <p className="mt-1 text-accent">Preferred slot: {order.deliverySlot}</p> : null}
                  {shipping.deliveryNotes ? (
                    <p className="mt-2 border-t border-line pt-2 text-caption text-ink-muted">
                      Note: {shipping.deliveryNotes}
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          {/* Payment Card */}
          <div className="border border-line bg-surface p-5">
            <h3 className="text-h4 font-semibold text-ink">Payment details</h3>
            <dl className="mt-3 flex flex-col gap-2 text-small text-ink">
              <div className="flex justify-between">
                <dt className="text-ink-muted">Method</dt>
                <dd className="font-medium">
                  {order.paymentMethod === "MPESA"
                    ? "M-Pesa"
                    : order.paymentMethod === "CARD"
                      ? "Credit / Debit Card"
                      : order.paymentMethod === "COD"
                        ? "Cash on delivery"
                        : "Invoice"}
                </dd>
              </div>

              {lastPayment?.providerRef ? (
                <div className="flex justify-between">
                  <dt className="text-ink-muted">Receipt code</dt>
                  <dd className="font-mono font-medium">{lastPayment.providerRef}</dd>
                </div>
              ) : null}

              {order.poNumber ? (
                <div className="flex justify-between">
                  <dt className="text-ink-muted">PO Number</dt>
                  <dd className="font-mono">{order.poNumber}</dd>
                </div>
              ) : null}
            </dl>
          </div>

          {/* Customer Support Card */}
          <div className="border border-line bg-ground p-5">
            <h3 className="text-h4 font-semibold text-ink">Support</h3>
            <p className="mt-2 text-small text-ink-muted">
              Need to alter delivery instructions or request an official tax invoice?
            </p>
            <div className="mt-3 flex flex-col gap-1 text-small">
              <a href="tel:+254796808822" className="text-accent underline hover:text-accent-deep">
                +254 796 808 822
              </a>
              <a href="mailto:info@safuney.com" className="text-accent underline hover:text-accent-deep">
                info@safuney.com
              </a>
            </div>
          </div>

          <div className="print:hidden">
            <Link
              href="/products"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-button border border-stainless bg-surface px-5 text-button text-ink hover:bg-ground-deep"
            >
              Continue shopping
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
