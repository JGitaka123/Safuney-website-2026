import type { Prisma, PrismaClient } from "@safuney/db";
import { money } from "@safuney/db";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * How long past its due date an invoice may sit before the account stops being supplied on credit.
 * Terms are the agreed date; this is the patience after it.
 */
export const STOP_SUPPLY_GRACE_DAYS = 15;

export interface CreditPosition {
  limitMinorUnits: bigint;
  /** Unpaid tax invoices. */
  outstandingMinorUnits: bigint;
  availableMinorUnits: bigint;
  termsDays: number;
  approved: boolean;
  /** Amount on invoices already past their due date. */
  overdueMinorUnits: bigint;
  /**
   * Set when an invoice is more than the grace period past due: no further credit orders until it is
   * settled. The customer can still pay by M-Pesa, card or cash.
   */
  stopSupply: boolean;
  stopSupplyReason: string | null;
}

/** Outstanding = every tax invoice not yet paid; credit notes reduce it. Overdue drives stop supply. */
export async function creditPosition(db: Db, customerId: string, now = new Date()): Promise<CreditPosition> {
  const customer = await db.customer.findUniqueOrThrow({ where: { id: customerId }, select: { status: true, creditLimitMinorUnits: true, creditTermsDays: true } });
  const open = await db.invoice.findMany({ where: { customerId, paidAt: null, type: { in: ["TAX", "CREDIT_NOTE"] } }, select: { number: true, type: true, totalMinorUnits: true, dueDate: true } });
  const outstanding = open.reduce((sum, i) => (i.type === "CREDIT_NOTE" ? sum - i.totalMinorUnits : sum + i.totalMinorUnits), 0n);
  const approved = customer.status === "CREDIT_APPROVED" && customer.creditLimitMinorUnits > 0n;

  const overdue = open.filter((i) => i.type === "TAX" && i.dueDate !== null && i.dueDate.getTime() < now.getTime());
  const overdueMinorUnits = overdue.reduce((sum, i) => sum + i.totalMinorUnits, 0n);
  // The oldest invoice past the grace period is the one that stops supply, and the one to name.
  const graceMs = STOP_SUPPLY_GRACE_DAYS * 86_400_000;
  const beyondGrace = overdue
    .filter((i) => now.getTime() - i.dueDate!.getTime() > graceMs)
    .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime())[0];
  const stopSupply = Boolean(beyondGrace);
  const daysLate = beyondGrace ? Math.floor((now.getTime() - beyondGrace.dueDate!.getTime()) / 86_400_000) : 0;

  return {
    limitMinorUnits: customer.creditLimitMinorUnits,
    outstandingMinorUnits: outstanding,
    // On stop supply there is no headroom at all, whatever the limit says.
    availableMinorUnits: approved && !stopSupply ? customer.creditLimitMinorUnits - outstanding : 0n,
    termsDays: customer.creditTermsDays,
    approved,
    overdueMinorUnits,
    stopSupply,
    stopSupplyReason: beyondGrace
      ? `Invoice ${beyondGrace.number} (${money.formatKes(beyondGrace.totalMinorUnits)}) is ${daysLate} days past its due date. Settle it to order on credit again, or pay by M-Pesa, card or cash.`
      : null,
  };
}

export class CreditError extends Error {
  constructor(
    public readonly code: "NOT_APPROVED" | "LIMIT" | "STOP_SUPPLY",
    message: string,
    public readonly position?: CreditPosition,
  ) {
    super(message);
  }
}

/**
 * Enforced inside the order transaction after locking the customer row, so two simultaneous invoice
 * orders cannot both fit into the same headroom.
 */
export async function assertCreditFor(tx: Prisma.TransactionClient, customerId: string, orderTotalMinorUnits: bigint, now = new Date()): Promise<CreditPosition> {
  await tx.$queryRaw`SELECT id FROM "Customer" WHERE id = ${customerId} FOR UPDATE`;
  const position = await creditPosition(tx, customerId, now);
  if (!position.approved) throw new CreditError("NOT_APPROVED", "Invoice payment is for approved credit accounts. Apply for an account or choose another method.", position);
  if (position.stopSupply) throw new CreditError("STOP_SUPPLY", position.stopSupplyReason ?? "An invoice is overdue. Settle it to order on credit again.", position);
  if (orderTotalMinorUnits > position.availableMinorUnits) {
    throw new CreditError(
      "LIMIT",
      position.availableMinorUnits > 0n
        ? `This order (${money.formatKes(orderTotalMinorUnits)}) is above the ${money.formatKes(position.availableMinorUnits)} of credit available. Settle an open invoice, split the order, or pay another way.`
        : `Your credit limit is fully used (${money.formatKes(position.outstandingMinorUnits)} outstanding). Settle an open invoice or pay another way.`,
      position,
    );
  }
  return position;
}
