import { describe, expect, it } from "vitest";
import { QuoteService, nextQuoteNumber } from "@/lib/quotes/service";
import type { PrismaClient, Prisma } from "@safuney/db";

describe("QuoteService unit logic", () => {
  describe("nextQuoteNumber generator", () => {
    it("generates formatted SFQ quote numbers with day and 4-digit sequence", async () => {
      const fixedDate = new Date("2026-09-09T12:00:00Z");
      const mockTx = {
        $executeRaw: async () => 1,
        quote: {
          findFirst: async () => ({ number: "SFQ-20260909-0007" }),
        },
      } as unknown as Prisma.TransactionClient;

      const num = await nextQuoteNumber(mockTx, fixedDate);
      expect(num).toBe("SFQ-20260909-0008");
    });

    it("starts from sequence 0001 if no prior quotes exist for the day", async () => {
      const fixedDate = new Date("2026-09-09T12:00:00Z");
      const mockTx = {
        $executeRaw: async () => 1,
        quote: {
          findFirst: async () => null,
        },
      } as unknown as Prisma.TransactionClient;

      const num = await nextQuoteNumber(mockTx, fixedDate);
      expect(num).toBe("SFQ-20260909-0001");
    });
  });

  describe("createQuote validation", () => {
    it("throws an error if no product items are provided", async () => {
      const mockPrisma = {} as unknown as PrismaClient;
      const svc = new QuoteService(mockPrisma);
      await expect(
        svc.createQuote({
          contactName: "John",
          contactEmail: "john@example.com",
          contactPhone: "+254712345678",
          items: [],
        }),
      ).rejects.toThrow(/At least one product line item is required/);
    });
  });

  describe("acceptQuote status check", () => {
    it("rejects acceptance if quote is still in REQUESTED status", async () => {
      const mockPrisma = {
        quote: {
          findUnique: async () => ({
            id: "q_1",
            number: "SFQ-20260909-0001",
            status: "REQUESTED",
            items: [],
          }),
        },
      } as unknown as PrismaClient;

      const svc = new QuoteService(mockPrisma);
      await expect(svc.acceptQuote("SFQ-20260909-0001")).rejects.toThrow(
        /Quote cannot be accepted because it is in status 'REQUESTED'/,
      );
    });

    it("accepts quote when status is PRICED", async () => {
      const mockPrisma = {
        quote: {
          findUnique: async () => ({
            id: "q_1",
            number: "SFQ-20260909-0001",
            status: "PRICED",
            items: [],
          }),
          update: async ({ data }: { data: { status: string } }) => ({
            number: "SFQ-20260909-0001",
            status: data.status,
          }),
        },
      } as unknown as PrismaClient;

      const svc = new QuoteService(mockPrisma);
      const res = await svc.acceptQuote("SFQ-20260909-0001");
      expect(res.status).toBe("ACCEPTED");
    });
  });
});
