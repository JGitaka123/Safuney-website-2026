import type { PrismaClient } from "@safuney/db";
import { CartError, CartService } from "@/lib/cart/service";

export class ListError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "FORBIDDEN" | "INVALID",
    message: string,
  ) {
    super(message);
  }
}

/**
 * Saved reorder lists (master prompt Phase 4) belong to a customer record. Individuals get a personal
 * customer record on first use; organisation members share the organisation's lists.
 */
export class SavedListService {
  constructor(private readonly prisma: PrismaClient) {}

  /** The customer whose lists a user works with: their organisation, else a personal record created on demand. */
  async customerFor(userId: string): Promise<string> {
    const membership = await this.prisma.customerMember.findFirst({ where: { userId }, orderBy: { createdAt: "asc" }, include: { customer: { select: { id: true, type: true } } } });
    const org = membership && membership.customer.type === "ORGANISATION" ? membership.customer.id : null;
    if (org) return org;
    if (membership) return membership.customer.id;
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, email: true, phone: true } });
    const c = await this.prisma.customer.create({ data: { type: "INDIVIDUAL", displayName: user.name ?? user.email ?? user.phone ?? "Customer", members: { create: { userId, role: "OWNER" } } } });
    return c.id;
  }

  private async assertMember(customerId: string, userId: string) {
    const m = await this.prisma.customerMember.findUnique({ where: { customerId_userId: { customerId, userId } } });
    if (!m) throw new ListError("FORBIDDEN", "That list belongs to another account.");
    return m;
  }

  async listsFor(userId: string) {
    const customerId = await this.customerFor(userId);
    return this.prisma.savedList.findMany({ where: { customerId }, orderBy: { updatedAt: "desc" }, include: { items: { include: { variant: { include: { product: { select: { name: true, slug: true, isActive: true, category: { select: { slug: true } } } } } } } } } });
  }

  async get(userId: string, listId: string) {
    const list = await this.prisma.savedList.findUnique({ where: { id: listId }, include: { items: { include: { variant: { include: { product: { select: { name: true, slug: true, isActive: true, needsPoReview: true, category: { select: { slug: true } } } } } } } } } });
    if (!list) throw new ListError("NOT_FOUND", "List not found.");
    await this.assertMember(list.customerId, userId);
    return list;
  }

  async create(userId: string, name: string, items: Array<{ variantId: string; qty: number }> = []) {
    const customerId = await this.customerFor(userId);
    const clean = name.trim();
    if (clean.length < 1 || clean.length > 60) throw new ListError("INVALID", "Give the list a short name, for example Weekly kitchen order.");
    return this.prisma.savedList.create({ data: { customerId, name: clean, items: { create: items.filter((i) => i.qty > 0).map((i) => ({ variantId: i.variantId, qty: Math.min(999, Math.floor(i.qty)) })) } } });
  }

  async rename(userId: string, listId: string, name: string) {
    const list = await this.get(userId, listId);
    const clean = name.trim();
    if (clean.length < 1 || clean.length > 60) throw new ListError("INVALID", "Give the list a short name.");
    return this.prisma.savedList.update({ where: { id: list.id }, data: { name: clean } });
  }

  async remove(userId: string, listId: string) {
    const list = await this.get(userId, listId);
    await this.prisma.savedList.delete({ where: { id: list.id } });
  }

  async setItem(userId: string, listId: string, variantId: string, qty: number) {
    const list = await this.get(userId, listId);
    if (qty <= 0) {
      await this.prisma.savedListItem.deleteMany({ where: { savedListId: list.id, variantId } });
      return;
    }
    const variant = await this.prisma.productVariant.findUnique({ where: { id: variantId }, select: { id: true } });
    if (!variant) throw new ListError("NOT_FOUND", "That pack is no longer in the catalogue.");
    await this.prisma.savedListItem.upsert({ where: { savedListId_variantId: { savedListId: list.id, variantId } }, create: { savedListId: list.id, variantId, qty: Math.min(999, Math.floor(qty)) }, update: { qty: Math.min(999, Math.floor(qty)) } });
    await this.prisma.savedList.update({ where: { id: list.id }, data: { updatedAt: new Date() } });
  }

  /** Copies an order's lines into a new list (from the tracking page or order history). */
  async fromOrder(userId: string, orderId: string, name: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order || order.userId !== userId) throw new ListError("NOT_FOUND", "Order not found.");
    return this.create(userId, name, order.items.filter((i) => i.variantId).map((i) => ({ variantId: i.variantId!, qty: i.qty })));
  }

  /** "Add all to cart": every line the shop can sell now; the rest are reported line by line. */
  async addToCart(carts: CartService, cartToken: string, lines: Array<{ variantId: string; qty: number }>) {
    const failures: Array<{ variantId: string; message: string }> = [];
    for (const l of lines) {
      try {
        await carts.add(cartToken, l.variantId, l.qty);
      } catch (e) {
        if (e instanceof CartError) failures.push({ variantId: l.variantId, message: e.message });
        else throw e;
      }
    }
    return failures;
  }
}
