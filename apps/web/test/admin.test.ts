/**
 * Phase 6 gate: every admin mutation refuses the wrong role and records an audit row.
 *
 * The registry is what makes this one test rather than two per action: `adminAction` records each
 * declared mutation, so a new action added without thinking is still checked here, and an action that
 * forgets its permission or its audit row fails immediately.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestClient, type PrismaClient, type UserRole } from "@safuney/db";

const url = process.env["DATABASE_URL"];
const run = url ? describe : describe.skip;

/** Swapped per test; every admin action resolves its actor through this. */
let current: { id: string; role: UserRole } | null = null;

vi.mock("@/lib/auth/session", () => ({
  viewer: async () => (current ? { ...current, name: null, email: `${current.role}@example.test`, phone: null, memberships: [] } : null),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { registeredActions } = await import("@/lib/admin/action");
const { ROLE_PERMISSIONS, can } = await import("@/lib/admin/permissions");
const { setVariantPrice, adjustStock, setProductReviewed, importCatalogue } = await import("@/lib/admin/actions");
const { markInvoicePaid, recordManualPayment, issueCreditNote } = await import("@/lib/admin/finance-actions");
const { markLeadHandled } = await import("@/lib/admin/lead-actions");
const { exportCatalogue, planImport } = await import("@/lib/admin/catalogue-csv");
const { parseCsv, toCsv } = await import("@/lib/admin/csv");

run("admin console", () => {
  let prisma: PrismaClient;
  const stamp = Date.now().toString(36);
  const users: Record<string, string> = {};
  let variantId: string;
  let productId: string;
  let orderId: string;
  let orderNumber: string;
  let invoiceId: string;
  let customerId: string;
  let leadId: string;

  const ROLES: UserRole[] = ["CUSTOMER", "B2B_BUYER", "B2B_APPROVER", "SALES", "WAREHOUSE", "FINANCE", "ADMIN"];

  beforeAll(async () => {
    prisma = createTestClient(url!);
    for (const role of ROLES) {
      users[role] = (await prisma.user.create({ data: { email: `adm-${role.toLowerCase()}-${stamp}@example.test`, role } })).id;
    }
    const cat = await prisma.category.create({ data: { slug: `adm-cat-${stamp}`, name: `Admin test ${stamp}` } });
    const product = await prisma.product.create({ data: { slug: `adm-p-${stamp}`, name: `Admin test formulation ${stamp}`, shortDescription: "For the admin tests.", categoryId: cat.id, isActive: false, needsPoReview: true } });
    productId = product.id;
    variantId = (await prisma.productVariant.create({ data: { productId, sku: `ADM-${stamp}`, packSizeValue: "5", unit: "L", packLabel: "5 L", priceMinorUnits: 100000n, vatRateBps: 1600, stockOnHand: 12 } })).id;
    customerId = (await prisma.customer.create({ data: { type: "ORGANISATION", displayName: `Admin test co ${stamp}`, status: "CREDIT_APPROVED", creditLimitMinorUnits: 500000n, creditTermsDays: 30 } })).id;
    const order = await prisma.order.create({
      data: {
        number: `SFN-TEST-${stamp}`,
        customerId,
        status: "CONFIRMED",
        subtotalMinorUnits: 100000n,
        vatMinorUnits: 16000n,
        deliveryMinorUnits: 0n,
        totalMinorUnits: 116000n,
        paymentMethod: "INVOICE",
        deliveryMethod: "DELIVERY",
        placedAt: new Date(),
      },
    });
    orderId = order.id;
    orderNumber = order.number;
    invoiceId = (await prisma.invoice.create({
      data: { number: `INV-TEST-${stamp}`, type: "TAX", orderId, customerId, sellerName: "Safuney Limited", buyerName: "Admin test co", lines: [], subtotalMinorUnits: 100000n, vatMinorUnits: 16000n, totalMinorUnits: 116000n, dueDate: new Date(Date.now() + 30 * 86_400_000) },
    })).id;
    leadId = (await prisma.lead.create({ data: { kind: "CONTACT", name: `Admin test lead ${stamp}`, message: "Called about drums." } })).id;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { actorId: { in: Object.values(users) } } });
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL safuney.allow_order_event_delete = 'on'");
      await tx.payment.deleteMany({ where: { orderId } });
      await tx.invoice.deleteMany({ where: { orderId } });
      await tx.order.deleteMany({ where: { id: orderId } });
    });
    await prisma.lead.deleteMany({ where: { id: leadId } });
    await prisma.customer.deleteMany({ where: { id: customerId } });
    await prisma.product.deleteMany({ where: { slug: `adm-p-${stamp}` } });
    await prisma.category.deleteMany({ where: { slug: `adm-cat-${stamp}` } });
    await prisma.user.deleteMany({ where: { id: { in: Object.values(users) } } });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    current = null;
  });

  it("declares every mutation in the registry with a permission no customer holds", () => {
    const actions = registeredActions();
    expect(actions.length).toBeGreaterThan(0);
    for (const a of actions) {
      expect(ROLE_PERMISSIONS.CUSTOMER).not.toContain(a.permission);
      expect(ROLE_PERMISSIONS.B2B_BUYER).not.toContain(a.permission);
      expect(ROLE_PERMISSIONS.B2B_APPROVER).not.toContain(a.permission);
      expect(ROLE_PERMISSIONS.ADMIN).toContain(a.permission);
    }
  });

  it("refuses a signed-out caller", async () => {
    current = null;
    const r = await setVariantPrice(variantId, "1500");
    expect(r.ok).toBe(false);
  });

  /**
   * The gate. Every action is called as every role; it must succeed exactly for the roles whose
   * permission set covers it, and be refused for the rest — including the roles that can reach the
   * console but not this desk.
   */
  it("refuses every role that does not hold the action's permission", async () => {
    const calls: Array<{ name: string; run: () => Promise<{ ok: boolean }> }> = [
      { name: "catalogue.variant.price", run: () => setVariantPrice(variantId, "1500") },
      { name: "catalogue.variant.stock", run: () => adjustStock(variantId, "12", "count") },
      { name: "catalogue.product.review", run: () => setProductReviewed(productId, false) },
      { name: "leads.handled", run: () => markLeadHandled(leadId, false) },
      { name: "finance.payment.record", run: () => recordManualPayment(orderNumber, "100", `deny-probe-${Math.random()}`) },
    ];
    const registry = new Map(registeredActions().map((a) => [a.name, a.permission]));

    for (const call of calls) {
      const permission = registry.get(call.name)!;
      for (const role of ROLES) {
        current = { id: users[role]!, role };
        const result = await call.run();
        expect(result.ok, `${call.name} as ${role}`).toBe(can(role, permission));
      }
    }
  });

  it("writes an audit row with the actor, the entity and what changed", async () => {
    current = { id: users["ADMIN"]!, role: "ADMIN" };
    const was = (await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } })).priceMinorUnits;
    const r = await setVariantPrice(variantId, "1,750.50");
    expect(r.ok).toBe(true);
    const row = await prisma.auditLog.findFirst({ where: { action: "catalogue.variant.price", entityId: variantId }, orderBy: { createdAt: "desc" } });
    expect(row?.actorId).toBe(users["ADMIN"]);
    expect(row?.entity).toBe("ProductVariant");
    expect((row?.after as { priceMinorUnits: string }).priceMinorUnits).toBe("175050");
    expect((row?.before as { priceMinorUnits: string }).priceMinorUnits).toBe(was.toString());
    const v = await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    expect(v.priceMinorUnits).toBe(175050n);
  });

  it("writes nothing at all when the handler refuses", async () => {
    current = { id: users["ADMIN"]!, role: "ADMIN" };
    const before = await prisma.auditLog.count({ where: { action: "catalogue.variant.price" } });
    const r = await setVariantPrice(variantId, "not a price");
    expect(r.ok).toBe(false);
    expect(await prisma.auditLog.count({ where: { action: "catalogue.variant.price" } })).toBe(before);
  });

  it("will not let a stock count go below what live orders have reserved", async () => {
    current = { id: users["ADMIN"]!, role: "ADMIN" };
    await prisma.productVariant.update({ where: { id: variantId }, data: { stockReserved: 4 } });
    const refused = await adjustStock(variantId, "2", "miscount");
    expect(refused.ok).toBe(false);
    const ok = await adjustStock(variantId, "9", "counted the shelf");
    expect(ok.ok).toBe(true);
    const v = await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    expect(v.stockOnHand).toBe(9);
    const move = await prisma.inventoryMovement.findFirst({ where: { variantId, reason: "counted the shelf" } });
    expect(move?.qty).toBe(9 - 12);
    await prisma.productVariant.update({ where: { id: variantId }, data: { stockReserved: 0 } });
  });

  it("publishing a product clears the review flag and makes it visible", async () => {
    current = { id: users["ADMIN"]!, role: "ADMIN" };
    const r = await setProductReviewed(productId, true);
    expect(r.ok).toBe(true);
    const p = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    expect(p.needsPoReview).toBe(false);
    expect(p.isActive).toBe(true);
  });

  describe("finance", () => {
    it("settles an invoice once, records the payment, and refuses the second attempt", async () => {
      current = { id: users["FINANCE"]!, role: "FINANCE" };
      const first = await markInvoicePaid(invoiceId, "FT2609ABCD", "");
      expect(first.ok).toBe(true);
      const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
      expect(invoice.paidAt).not.toBeNull();
      const payment = await prisma.payment.findFirst({ where: { orderId, idempotencyKey: `invoice-settled:${invoiceId}` } });
      expect(payment?.amountMinorUnits).toBe(116000n);
      expect(payment?.status).toBe("SUCCEEDED");

      const second = await markInvoicePaid(invoiceId, "FT2609ABCD", "");
      expect(second.ok).toBe(false);
      expect(await prisma.payment.count({ where: { orderId, idempotencyKey: `invoice-settled:${invoiceId}` } })).toBe(1);
    });

    it("settling an invoice is what frees the account's credit again", async () => {
      const { creditPosition } = await import("@/lib/b2b/credit");
      const after = await creditPosition(prisma, customerId);
      // The one invoice on this account is settled, so nothing is outstanding and the whole limit is free.
      expect(after.outstandingMinorUnits).toBe(0n);
      expect(after.availableMinorUnits).toBe(500000n);
      expect(after.stopSupply).toBe(false);
    });

    it("records a manual payment once per reference", async () => {
      current = { id: users["FINANCE"]!, role: "FINANCE" };
      const ref = `CASH-${stamp}`;
      expect((await recordManualPayment(orderNumber, "5,000", ref)).ok).toBe(true);
      const again = await recordManualPayment(orderNumber, "5,000", ref);
      expect(again.ok).toBe(false);
      expect(await prisma.payment.count({ where: { orderId, providerRef: ref } })).toBe(1);
    });

    it("credits back part of an order and refuses more than it is worth", async () => {
      current = { id: users["FINANCE"]!, role: "FINANCE" };
      // The order is KES 1,160.00 in total.
      const tooMuch = await issueCreditNote(orderNumber, "2,000", "return");
      expect(tooMuch.ok).toBe(false);
      expect(tooMuch.ok === false && tooMuch.message).toContain("1160.00");

      const part = await issueCreditNote(orderNumber, "400", "One drum returned unopened.");
      expect(part.ok).toBe(true);
      const note = await prisma.invoice.findFirst({ where: { orderId, type: "CREDIT_NOTE" } });
      expect(note?.totalMinorUnits).toBe(40000n);

      // A second note may still be issued up to the order total, but not past it.
      expect((await issueCreditNote(orderNumber, "800", "rest")).ok).toBe(false);
      expect((await issueCreditNote(orderNumber, "760", "The remainder.")).ok).toBe(true);
    });
  });

  describe("catalogue CSV", () => {
    it("survives quotes, commas, embedded newlines and a BOM", () => {
      const written = toCsv(["sku", "name"], [{ sku: "A-1", name: 'Bleach, "strong"\nsecond line' }]);
      const read = parseCsv(`﻿${written}`);
      expect(read.headers).toEqual(["sku", "name"]);
      expect(read.rows).toHaveLength(1);
      expect(read.rows[0]?.["name"]).toBe('Bleach, "strong"\nsecond line');
    });

    it("a round trip changes nothing", async () => {
      const csv = await exportCatalogue();
      const plan = await planImport(csv);
      expect(plan.counts.error).toBe(0);
      expect(plan.counts.new).toBe(0);
      expect(plan.counts.changed).toBe(0);
      expect(plan.counts.unchanged).toBeGreaterThan(0);
    });

    it("names the column and the value on a bad row, and refuses the whole file", async () => {
      current = { id: users["ADMIN"]!, role: "ADMIN" };
      const csv = await exportCatalogue();
      const lines = csv.split("\r\n");
      const target = lines.findIndex((l) => l.startsWith(`ADM-${stamp},`));
      expect(target).toBeGreaterThan(0);
      const cells = lines[target]!.split(",");
      const priceCol = csv.split("\r\n")[0]!.split(",").indexOf("price_kes");
      cells[priceCol] = "twelve hundred";
      lines[target] = cells.join(",");
      const withError = lines.join("\r\n");
      const plan = await planImport(withError);
      expect(plan.counts.error).toBe(1);
      expect(plan.rows.find((r) => r.kind === "error")?.error).toContain("price_kes");

      const before = await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } });
      const result = await importCatalogue(withError);
      expect(result.ok).toBe(false);
      const after = await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } });
      expect(after.priceMinorUnits).toBe(before.priceMinorUnits);
    });

    it("applies a price change and records the stock move", async () => {
      current = { id: users["ADMIN"]!, role: "ADMIN" };
      const csv = await exportCatalogue();
      const lines = csv.split("\r\n");
      const headers = lines[0]!.split(",");
      const target = lines.findIndex((l) => l.startsWith(`ADM-${stamp},`));
      const cells = lines[target]!.split(",");
      cells[headers.indexOf("price_kes")] = "2500.00";
      cells[headers.indexOf("stock_on_hand")] = "40";
      lines[target] = cells.join(",");
      const edited = lines.join("\r\n");

      const plan = await planImport(edited);
      expect(plan.counts.changed).toBe(1);
      const changed = plan.rows.find((r) => r.kind === "changed")!;
      expect(changed.changes.map((c) => c.field).sort()).toEqual(["price_kes", "stock_on_hand"]);

      const applied = await importCatalogue(edited);
      expect(applied.ok, applied.message).toBe(true);
      const v = await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } });
      expect(v.priceMinorUnits).toBe(250000n);
      expect(v.stockOnHand).toBe(40);
      const move = await prisma.inventoryMovement.findFirst({ where: { variantId, reason: "csv_import" }, orderBy: { createdAt: "desc" } });
      expect(move?.qty).toBe(40 - 9);
    });
  });
});
