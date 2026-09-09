import type { Prisma, PrismaClient } from "@safuney/db";
import { money } from "@safuney/db";

type Db = PrismaClient | Prisma.TransactionClient;

export interface CreditPosition {
  limitMinorUnits: bigint;
  /** Unpaid tax invoices. */
  outstandingMinorUnits: bigint;
  availableMinorUnits: bigint;
  termsDays: number;
  approved: boolean;
}

/** Outstanding = every tax invoice not yet paid; credit notes reduce it. */
export async function creditPosition(db: Db, customerId: string): Promise<CreditPosition> {
  const customer = await db.customer.findUniqueOrThrow({ where: { id: customerId }, select: { status: true, creditLimitMinorUnits: true, creditTermsDays: true } });
  const open = await db.invoice.findMany({ where: { customerId, paidAt: null, type: { in: ["TAX", "CREDIT_NOTE"] } }, select: { type: true, totalMinorUnits: true } });
  const outstanding = open.reduce((sum, i) => (i.type === "CREDIT_NOTE" ? sum - i.totalMinorUnits : sum + i.totalMinorUnits), 0n);
  const approved = customer.status === "CREDIT_APPROVED" && customer.creditLimitMinorUnits > 0n;
  return {
    limitMinorUnits: customer.creditLimitMinorUnits,
    outstandingMinorUnits: outstanding,
    availableMinorUnits: approved ? customer.creditLimitMinorUnits - outstanding : 0n,
    termsDays: customer.creditTermsDays,
    approved,
  };
}

export class CreditError extends Error {
  constructor(
    public readonly code: "NOT_APPROVED" | "LIMIT",
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
export async function assertCreditFor(tx: Prisma.TransactionClient, customerId: string, orderTotalMinorUnits: bigint): Promise<CreditPosition> {
  await tx.$queryRaw`SELECT id FROM "Customer" WHERE id = ${customerId} FOR UPDATE`;
  const position = await creditPosition(tx, customerId);
  if (!position.approved) throw new CreditError("NOT_APPROVED", "Invoice payment is for approved credit accounts. Apply for an account or choose another method.", position);
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
