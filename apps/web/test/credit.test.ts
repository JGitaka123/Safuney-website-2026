import { describe, expect, it } from "vitest";
import { CreditService, type CreditProfile } from "@/lib/credit/service";
import type { PrismaClient } from "@safuney/db";

describe("CreditService unit logic", () => {
  const dummyPrisma = {} as unknown as PrismaClient;
  const service = new CreditService(dummyPrisma);

  describe("needsOrderApproval", () => {
    const baseProfile: CreditProfile = {
      customerId: "cust_123",
      displayName: "Test Corp",
      status: "CREDIT_APPROVED",
      creditLimitMinorUnits: 50000000n, // KES 500k
      creditTermsDays: 30,
      approvalThresholdMinorUnits: 10000000n, // KES 100k
      outstandingBalanceMinorUnits: 0n,
      availableCreditMinorUnits: 50000000n,
      isCreditApproved: true,
      isStopSupply: false,
      canBuyOnInvoice: true,
      unpaidOrdersCount: 0,
    };

    it("requires approval when a BUYER places an order exceeding the threshold", () => {
      // Order of KES 120k > KES 100k threshold
      const orderTotal = 12000000n;
      const needed = service.needsOrderApproval(baseProfile, "BUYER", orderTotal);
      expect(needed).toBe(true);
    });

    it("does not require approval when order is within the threshold", () => {
      // Order of KES 80k <= KES 100k threshold
      const orderTotal = 8000000n;
      const needed = service.needsOrderApproval(baseProfile, "BUYER", orderTotal);
      expect(needed).toBe(false);
    });

    it("does not require approval for APPROVER or OWNER even above threshold", () => {
      const orderTotal = 15000000n;
      expect(service.needsOrderApproval(baseProfile, "APPROVER", orderTotal)).toBe(false);
      expect(service.needsOrderApproval(baseProfile, "OWNER", orderTotal)).toBe(false);
    });

    it("does not require approval if customer has no approval threshold set", () => {
      const profileNoThreshold = { ...baseProfile, approvalThresholdMinorUnits: null };
      expect(service.needsOrderApproval(profileNoThreshold, "BUYER", 99999999n)).toBe(false);
    });
  });

  describe("stop-supply and credit limit assertions", () => {
    it("rejects an unapproved customer", async () => {
      const mockPrisma = {
        customer: {
          findUnique: async () => ({
            id: "cust_unapproved",
            displayName: "New Entity",
            status: "PENDING_CREDIT_APPROVAL",
            creditLimitMinorUnits: 0n,
            creditTermsDays: 30,
            approvalThresholdMinorUnits: null,
            orders: [],
          }),
        },
      } as unknown as PrismaClient;

      const svc = new CreditService(mockPrisma);
      await expect(svc.assertCanPlaceInvoiceOrder("cust_unapproved", 500000n)).rejects.toThrow(
        /only available to approved corporate credit accounts/,
      );
    });

    it("rejects an order that exceeds available credit limit", async () => {
      const mockPrisma = {
        customer: {
          findUnique: async () => ({
            id: "cust_active",
            displayName: "Sarova Hotels",
            status: "CREDIT_APPROVED",
            creditLimitMinorUnits: 10000000n, // KES 100,000.00
            creditTermsDays: 30,
            approvalThresholdMinorUnits: null,
            orders: [
              {
                id: "ord_1",
                number: "SFN-20260901-0001",
                totalMinorUnits: 7000000n, // KES 70,000.00 outstanding
                placedAt: new Date(),
                createdAt: new Date(),
                payments: [],
              },
            ],
          }),
        },
      } as unknown as PrismaClient;

      const svc = new CreditService(mockPrisma);
      // Available credit is 30,000. Trying to place 40,000 should be rejected.
      await expect(svc.assertCanPlaceInvoiceOrder("cust_active", 4000000n)).rejects.toThrow(
        /exceeds available credit limit/,
      );
    });

    it("enforces stop-supply if an invoice order is overdue past 15 days", async () => {
      // 30 days terms + 16 days overdue = 46 days old
      const oldDate = new Date(Date.now() - 46 * 86_400_000);
      const mockPrisma = {
        customer: {
          findUnique: async () => ({
            id: "cust_overdue",
            displayName: "Late Payer Ltd",
            status: "CREDIT_APPROVED",
            creditLimitMinorUnits: 20000000n,
            creditTermsDays: 30,
            approvalThresholdMinorUnits: null,
            orders: [
              {
                id: "ord_overdue",
                number: "SFN-20260720-0005",
                totalMinorUnits: 5000000n,
                placedAt: oldDate,
                createdAt: oldDate,
                payments: [],
              },
            ],
          }),
        },
      } as unknown as PrismaClient;

      const svc = new CreditService(mockPrisma);
      await expect(svc.assertCanPlaceInvoiceOrder("cust_overdue", 1000000n)).rejects.toThrow(
        /Credit ordering suspended.*SFN-20260720-0005 is overdue past the 15-day grace period/,
      );
    });

    it("allows placing order within available limit with no overdue invoices", async () => {
      const mockPrisma = {
        customer: {
          findUnique: async () => ({
            id: "cust_good",
            displayName: "Good Hotel",
            status: "CREDIT_APPROVED",
            creditLimitMinorUnits: 30000000n, // KES 300k
            creditTermsDays: 30,
            approvalThresholdMinorUnits: null,
            orders: [],
          }),
        },
      } as unknown as PrismaClient;

      const svc = new CreditService(mockPrisma);
      const profile = await svc.assertCanPlaceInvoiceOrder("cust_good", 5000000n);
      expect(profile.isCreditApproved).toBe(true);
      expect(profile.availableCreditMinorUnits).toBe(30000000n);
    });
  });
});
