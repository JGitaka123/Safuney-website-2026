import type { Prisma } from "@safuney/db";
import { site } from "@/config/site";

export const INVOICE_NUMBER_PREFIX = "INV";

/** INV-YYYYMMDD-NNNN; serialised with an advisory lock inside the caller's transaction. */
export async function nextInvoiceNumber(tx: Prisma.TransactionClient, now = new Date()): Promise<string> {
  const day = now.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `${INVOICE_NUMBER_PREFIX}-${day}-`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('invoice-number'))`;
  const last = await tx.invoice.findFirst({ where: { number: { startsWith: prefix } }, orderBy: { number: "desc" }, select: { number: true } });
  const seq = last ? Number(last.number.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export interface InvoiceLine {
  sku: string;
  description: string;
  qty: number;
  unitPriceMinorUnits: string;
  vatRateBps: number;
  lineTotalMinorUnits: string;
  lineVatMinorUnits: string;
}

/**
 * Issues the tax invoice for a confirmed invoice order (KRA-compliant snapshot: seller and buyer PINs,
 * itemised VAT). The seller PIN comes from site config once the PO supplies it (question 4); until
 * then the field is empty and the PDF says so.
 */
export async function issueTaxInvoice(tx: Prisma.TransactionClient, orderId: string, now = new Date()): Promise<{ id: string; number: string }> {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true, customer: true } });
  const existing = await tx.invoice.findFirst({ where: { orderId, type: "TAX" }, select: { id: true, number: true } });
  if (existing) return existing;
  const termsDays = order.customer?.creditTermsDays ?? 0;
  const billing = (order.billingAddress ?? {}) as { name?: string; organisation?: string };
  const lines: InvoiceLine[] = order.items.map((i) => ({ sku: i.sku, description: `${i.name} ${i.packLabel}`, qty: i.qty, unitPriceMinorUnits: i.unitPriceMinorUnits.toString(), vatRateBps: i.vatRateBps, lineTotalMinorUnits: i.lineTotalMinorUnits.toString(), lineVatMinorUnits: i.lineVatMinorUnits.toString() }));
  if (order.deliveryMinorUnits > 0n) lines.push({ sku: "DELIVERY", description: "Delivery", qty: 1, unitPriceMinorUnits: order.deliveryMinorUnits.toString(), vatRateBps: 0, lineTotalMinorUnits: order.deliveryMinorUnits.toString(), lineVatMinorUnits: "0" });
  const number = await nextInvoiceNumber(tx, now);
  const invoice = await tx.invoice.create({
    data: {
      number,
      type: "TAX",
      orderId,
      customerId: order.customerId,
      issuedAt: now,
      dueDate: new Date(now.getTime() + termsDays * 86_400_000),
      sellerName: site.legalName,
      sellerKraPin: process.env["COMPANY_KRA_PIN"] ?? null,
      sellerVatNumber: process.env["COMPANY_VAT_NUMBER"] ?? null,
      buyerName: order.customer?.legalName ?? order.customer?.displayName ?? billing.organisation ?? billing.name ?? "Customer",
      buyerKraPin: order.customer?.kraPin ?? null,
      lines: lines as unknown as Prisma.InputJsonValue,
      subtotalMinorUnits: order.subtotalMinorUnits + order.deliveryMinorUnits,
      vatMinorUnits: order.vatMinorUnits,
      totalMinorUnits: order.totalMinorUnits,
    },
    select: { id: true, number: true },
  });
  return invoice;
}
