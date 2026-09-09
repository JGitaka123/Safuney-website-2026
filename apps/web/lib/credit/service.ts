import { type PrismaClient } from "@safuney/db";

export const STOP_SUPPLY_OVERDUE_GRACE_DAYS = 15;

export interface CreditProfile {
  customerId: string;
  displayName: string;
  status: string;
  creditLimitMinorUnits: bigint;
  creditTermsDays: number;
  approvalThresholdMinorUnits: bigint | null;
  outstandingBalanceMinorUnits: bigint;
  availableCreditMinorUnits: bigint;
  isCreditApproved: boolean;
  isStopSupply: boolean;
  stopSupplyReason?: string;
  canBuyOnInvoice: boolean;
  unpaidOrdersCount: number;
}

export class CreditError extends Error {
  constructor(
    public readonly code: "NOT_APPROVED" | "STOP_SUPPLY" | "LIMIT_EXCEEDED" | "NOT_FOUND",
    message: string,
  ) {
    super(message);
  }
}

export class CreditService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async getCreditProfile(customerId: string): Promise<CreditProfile> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        orders: {
          where: {
            paymentMethod: "INVOICE",
            status: { in: ["CONFIRMED", "PACKED", "DISPATCHED", "DELIVERED"] },
          },
          select: {
            id: true,
            number: true,
            totalMinorUnits: true,
            placedAt: true,
            createdAt: true,
            payments: {
              where: { status: "SUCCEEDED" },
              select: { id: true },
            },
          },
        },
      },
    });

    if (!customer) {
      throw new CreditError("NOT_FOUND", "Customer organisation not found.");
    }

    // Only orders with no successful payments are outstanding
    const unpaidOrders = customer.orders.filter((o) => o.payments.length === 0);
    const outstanding = unpaidOrders.reduce((sum, o) => sum + o.totalMinorUnits, 0n);

    // Stop-supply check: 15 days overdue past creditTermsDays
    const termsMs = (customer.creditTermsDays || 30) * 86_400_000;
    const graceMs = STOP_SUPPLY_OVERDUE_GRACE_DAYS * 86_400_000;
    const currentTime = this.now().getTime();

    let isStopSupply = false;
    let stopSupplyReason: string | undefined;

    for (const ord of unpaidOrders) {
      const orderDate = (ord.placedAt ?? ord.createdAt).getTime();
      const overdueDeadline = orderDate + termsMs + graceMs;
      if (currentTime > overdueDeadline) {
        const daysPastGrace = Math.floor((currentTime - overdueDeadline) / 86_400_000);
        isStopSupply = true;
        stopSupplyReason = `Order ${ord.number} is overdue past the ${STOP_SUPPLY_OVERDUE_GRACE_DAYS}-day grace period (${daysPastGrace + STOP_SUPPLY_OVERDUE_GRACE_DAYS} days past terms).`;
        break;
      }
    }

    const isCreditApproved = customer.status === "CREDIT_APPROVED" && customer.creditLimitMinorUnits > 0n;
    const available = isStopSupply || !isCreditApproved
      ? 0n
      : customer.creditLimitMinorUnits > outstanding
      ? customer.creditLimitMinorUnits - outstanding
      : 0n;

    return {
      customerId: customer.id,
      displayName: customer.displayName,
      status: customer.status,
      creditLimitMinorUnits: customer.creditLimitMinorUnits,
      creditTermsDays: customer.creditTermsDays,
      approvalThresholdMinorUnits: customer.approvalThresholdMinorUnits,
      outstandingBalanceMinorUnits: outstanding,
      availableCreditMinorUnits: available,
      isCreditApproved,
      isStopSupply,
      stopSupplyReason,
      canBuyOnInvoice: isCreditApproved && !isStopSupply && available > 0n,
      unpaidOrdersCount: unpaidOrders.length,
    };
  }

  async assertCanPlaceInvoiceOrder(customerId: string, orderTotalMinorUnits: bigint): Promise<CreditProfile> {
    const profile = await this.getCreditProfile(customerId);

    if (!profile.isCreditApproved) {
      throw new CreditError("NOT_APPROVED", "Invoice payment is only available to approved corporate credit accounts.");
    }

    if (profile.isStopSupply) {
      throw new CreditError(
        "STOP_SUPPLY",
        `Credit ordering suspended: ${profile.stopSupplyReason ?? "An invoice is overdue past 15 days."} Please settle outstanding invoices or pay via M-Pesa/card.`,
      );
    }

    if (orderTotalMinorUnits > profile.availableCreditMinorUnits) {
      const availableKES = (Number(profile.availableCreditMinorUnits) / 100).toLocaleString("en-KE", { minimumFractionDigits: 2 });
      const orderKES = (Number(orderTotalMinorUnits) / 100).toLocaleString("en-KE", { minimumFractionDigits: 2 });
      throw new CreditError(
        "LIMIT_EXCEEDED",
        `Order total (KES ${orderKES}) exceeds available credit limit (KES ${availableKES}). Settle open orders or contact Safuney to request a credit limit increase.`,
      );
    }

    return profile;
  }

  needsOrderApproval(
    profile: CreditProfile,
    memberRole: string | null | undefined,
    orderTotalMinorUnits: bigint,
  ): boolean {
    if (memberRole !== "BUYER") return false;
    if (!profile.approvalThresholdMinorUnits || profile.approvalThresholdMinorUnits <= 0n) return false;
    return orderTotalMinorUnits > profile.approvalThresholdMinorUnits;
  }
}
