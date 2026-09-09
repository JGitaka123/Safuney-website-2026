import { type Prisma, type PrismaClient, type QuoteStatus } from "@safuney/db";
import { QUOTE_NUMBER_PREFIX } from "@safuney/config";

export interface QuoteItemInput {
  variantId?: string;
  description: string;
  qty: number;
  unitPriceMinorUnits?: bigint;
  vatRateBps?: number;
}

export interface CreateQuoteInput {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  customerId?: string;
  notes?: string;
  items: QuoteItemInput[];
}

export async function nextQuoteNumber(tx: Prisma.TransactionClient, now = new Date()): Promise<string> {
  const day = now.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `${QUOTE_NUMBER_PREFIX}-${day}-`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('quote-number'))`;
  const last = await tx.quote.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const seq = last ? Number(last.number.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export class QuoteService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async createQuote(input: CreateQuoteInput) {
    if (!input.items || input.items.length === 0) {
      throw new Error("At least one product line item is required for a quote request.");
    }

    return this.prisma.$transaction(async (tx) => {
      const number = await nextQuoteNumber(tx, this.now());
      const quote = await tx.quote.create({
        data: {
          number,
          customerId: input.customerId ?? null,
          contactName: input.contactName,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone,
          notes: input.notes ?? null,
          status: "REQUESTED",
          items: {
            createMany: {
              data: input.items.map((it) => ({
                variantId: it.variantId ?? null,
                description: it.description,
                qty: Math.max(1, it.qty),
                unitPriceMinorUnits: it.unitPriceMinorUnits ?? null,
                vatRateBps: it.vatRateBps ?? 1600,
              })),
            },
          },
        },
        include: {
          items: true,
        },
      });

      return quote;
    });
  }

  async getQuoteByNumber(number: string) {
    return this.prisma.quote.findUnique({
      where: { number },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: true,
              },
            },
          },
        },
        customer: true,
      },
    });
  }

  async listQuotes(customerId: string) {
    return this.prisma.quote.findMany({
      where: { customerId },
      include: {
        items: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async acceptQuote(number: string, customerId?: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { number },
      include: { items: true },
    });

    if (!quote) throw new Error("Quote not found.");
    if (customerId && quote.customerId && quote.customerId !== customerId) {
      throw new Error("Unauthorized to accept this quote.");
    }
    if (quote.status !== "PRICED") {
      throw new Error(`Quote cannot be accepted because it is in status '${quote.status}'.`);
    }

    return this.prisma.quote.update({
      where: { number },
      data: {
        status: "ACCEPTED",
        acceptedAt: this.now(),
      },
    });
  }
}
