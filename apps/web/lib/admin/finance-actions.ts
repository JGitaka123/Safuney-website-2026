"use server";

import { revalidatePath } from "next/cache";
import { db } from "@safuney/db";
import { site } from "@/config/site";
import { nextInvoiceNumber } from "@/lib/b2b/invoices";
import { adminAction, AdminError, type AdminResult } from "./action";

function parseKes(raw: string): bigint | null {
  const cleaned = raw.replace(/[,\s]|KES/gi, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  return BigInt(whole!) * 100n + BigInt(frac.padEnd(2, "0"));
}

/**
 * Marks an invoice settled.
 *
 * Phase 4 shipped credit that only ever accumulated: an account's outstanding balance grew with every
 * invoice and nothing could ever reduce it, so every credit customer would eventually stop-supply
 * itself. This is the missing half.
 *
 * The claim is conditional on `paidAt` still being null, so two people in finance clicking at once
 * record one payment, not two.
 */
export const markInvoicePaid = adminAction(
  "finance.invoice.paid",
  "invoices.write",
  "Invoice",
  async (ctx, invoiceId: string, reference: string, receivedOn: string): Promise<AdminResult> => {
    const ref = reference.trim();
    if (!ref) throw new AdminError("Record the bank or M-Pesa reference the money arrived with.");
    const when = receivedOn.trim() ? new Date(`${receivedOn}T12:00:00Z`) : new Date();
    if (Number.isNaN(when.getTime())) throw new AdminError("That is not a date.");
    if (when.getTime() > Date.now() + 86_400_000) throw new AdminError("That date is in the future.");

    const invoice = await db().invoice.findUnique({ where: { id: invoiceId }, select: { number: true, type: true, orderId: true, totalMinorUnits: true, paidAt: true } });
    if (!invoice) throw new AdminError("That invoice no longer exists.");
    if (invoice.type !== "TAX") throw new AdminError("Only a tax invoice is settled this way.");
    if (invoice.paidAt) throw new AdminError(`Invoice ${invoice.number} was already recorded as paid.`);

    const result = await db().$transaction(async (tx) => {
      const claim = await tx.invoice.updateMany({ where: { id: invoiceId, paidAt: null }, data: { paidAt: when } });
      if (claim.count !== 1) return null;
      await tx.payment.create({
        data: {
          orderId: invoice.orderId,
          provider: "MANUAL",
          providerRef: ref,
          amountMinorUnits: invoice.totalMinorUnits,
          status: "SUCCEEDED",
          // Derived, not random: a second attempt at the same settlement hits the unique index.
          idempotencyKey: `invoice-settled:${invoiceId}`,
          confirmedAt: when,
        },
      });
      const order = await tx.order.findUniqueOrThrow({ where: { id: invoice.orderId }, select: { status: true } });
      await tx.orderEvent.create({ data: { orderId: invoice.orderId, status: order.status, type: "invoice_settled", actorId: ctx.who.id, payload: { invoice: invoice.number, reference: ref } } });
      return true;
    });
    if (!result) throw new AdminError(`Invoice ${invoice.number} was already recorded as paid.`);

    ctx.audit({ entity: "Invoice", entityId: invoiceId, before: { paidAt: null }, after: { paidAt: when.toISOString(), reference: ref } });
    revalidatePath("/admin/orders");
    revalidatePath("/sales/credit");
    return { ok: true, message: `Invoice ${invoice.number} settled.`, id: invoiceId };
  },
);

/**
 * Records money that arrived outside the site — a bank transfer, a cash payment at the depot, an
 * M-Pesa paybill entry the callback never reached — against an order.
 *
 * The order status is left to the order service; this only records the money, because a partial
 * payment is not a paid order and finance should not be able to move an order forward by typing a
 * number.
 */
export const recordManualPayment = adminAction(
  "finance.payment.record",
  "payments.write",
  "Payment",
  async (ctx, orderNumber: string, amountKes: string, reference: string): Promise<AdminResult> => {
    const amount = parseKes(amountKes);
    if (amount === null || amount <= 0n) throw new AdminError("Enter the amount in shillings, for example 12,500.");
    const ref = reference.trim();
    if (!ref) throw new AdminError("Record the reference the money arrived with.");
    const order = await db().order.findUnique({ where: { number: orderNumber }, select: { id: true, status: true, number: true } });
    if (!order) throw new AdminError(`No order ${orderNumber}.`);

    try {
      await db().payment.create({
        data: {
          orderId: order.id,
          provider: "MANUAL",
          providerRef: ref,
          amountMinorUnits: amount,
          status: "SUCCEEDED",
          // The same reference recorded twice against the same order is a double entry, not a second
          // payment; the unique index is what stops it.
          idempotencyKey: `manual:${order.id}:${ref}`,
          confirmedAt: new Date(),
        },
      });
    } catch {
      throw new AdminError(`Reference ${ref} is already recorded against ${order.number}.`);
    }
    await db().orderEvent.create({ data: { orderId: order.id, status: order.status, type: "payment_recorded", actorId: ctx.who.id, payload: { reference: ref, amountMinorUnits: amount.toString() } } });
    ctx.audit({ entity: "Payment", entityId: order.id, after: { order: order.number, reference: ref, amountMinorUnits: amount.toString() } });
    revalidatePath(`/admin/orders/${order.number}`);
    return { ok: true, message: `Recorded against ${order.number}.`, id: order.id };
  },
);

/**
 * Issues a credit note against an order — a return, a short delivery, a goodwill adjustment. The
 * credit position already nets credit notes off what an account owes, so this is what makes a
 * disputed invoice stop blocking supply.
 */
export const issueCreditNote = adminAction(
  "finance.credit-note.issue",
  "invoices.write",
  "Invoice",
  async (ctx, orderNumber: string, amountKes: string, reason: string): Promise<AdminResult> => {
    const amount = parseKes(amountKes);
    if (amount === null || amount <= 0n) throw new AdminError("Enter the amount to credit, in shillings.");
    if (!reason.trim()) throw new AdminError("Say why this credit note is being issued; it goes on the document.");
    const order = await db().order.findUnique({ where: { number: orderNumber }, select: { id: true, number: true, status: true, customerId: true, totalMinorUnits: true, customer: { select: { displayName: true, legalName: true, kraPin: true } } } });
    if (!order) throw new AdminError(`No order ${orderNumber}.`);

    const credited = await db().invoice.aggregate({ where: { orderId: order.id, type: "CREDIT_NOTE" }, _sum: { totalMinorUnits: true } });
    const already = credited._sum.totalMinorUnits ?? 0n;
    if (already + amount > order.totalMinorUnits) {
      throw new AdminError(`That would credit more than the order is worth. ${already > 0n ? `Already credited: ${(Number(already) / 100).toFixed(2)}. ` : ""}The order total is ${(Number(order.totalMinorUnits) / 100).toFixed(2)}.`);
    }

    const note = await db().$transaction(async (tx) => {
      const number = await nextInvoiceNumber(tx);
      return tx.invoice.create({
        data: {
          number,
          type: "CREDIT_NOTE",
          orderId: order.id,
          customerId: order.customerId,
          sellerName: site.legalName,
          sellerKraPin: process.env["COMPANY_KRA_PIN"] ?? null,
          sellerVatNumber: process.env["COMPANY_VAT_NUMBER"] ?? null,
          buyerName: order.customer?.legalName ?? order.customer?.displayName ?? "Customer",
          buyerKraPin: order.customer?.kraPin ?? null,
          lines: [{ sku: "CREDIT", description: reason.trim(), qty: 1, unitPriceMinorUnits: amount.toString(), vatRateBps: 0, lineTotalMinorUnits: amount.toString(), lineVatMinorUnits: "0" }] as never,
          subtotalMinorUnits: amount,
          vatMinorUnits: 0n,
          totalMinorUnits: amount,
        },
        select: { id: true, number: true },
      });
    });
    await db().orderEvent.create({ data: { orderId: order.id, status: order.status, type: "credit_note_issued", actorId: ctx.who.id, payload: { invoice: note.number, amountMinorUnits: amount.toString(), reason: reason.trim() } } });
    ctx.audit({ entity: "Invoice", entityId: note.id, after: { number: note.number, order: order.number, amountMinorUnits: amount.toString(), reason: reason.trim() } });
    revalidatePath(`/admin/orders/${order.number}`);
    revalidatePath("/sales/credit");
    return { ok: true, message: `Credit note ${note.number} issued.`, id: note.id };
  },
);
