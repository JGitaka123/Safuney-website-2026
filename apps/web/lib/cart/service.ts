/**
 * Server-side cart (non-negotiable #1: the client never sends prices; totals are recomputed here
 * from the catalogue on every read). Stock is checked on add/update; reservation happens at
 * checkout (Phase 3), so the cart only ever holds "intent".
 */
import { money, Prisma, type PrismaClient } from "@safuney/db";
import { releaseExpiredReservations } from "@/lib/orders/reservations";
import { priceListFor, resolvePrices } from "@/lib/b2b/pricing";
import { randomBytes } from "node:crypto";

export const CART_COOKIE = "sfn_cart";
export const CART_TTL_DAYS = 30;
export const MAX_QTY = 999;

const cartInclude = {
  items: {
    orderBy: { createdAt: "asc" },
    include: {
      variant: {
        select: {
          id: true,
          sku: true,
          packLabel: true,
          priceMinorUnits: true,
          vatRateBps: true,
          stockOnHand: true,
          stockReserved: true,
          isMadeToOrder: true,
          isActive: true,
          weightGrams: true,
          product: { select: { id: true, slug: true, name: true, isActive: true, needsPoReview: true, zone: true, category: { select: { slug: true, parent: { select: { slug: true } } } } } },
        },
      },
    },
  },
} satisfies Prisma.CartInclude;

export type CartRecord = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

export interface CartLine {
  id: string;
  variantId: string;
  sku: string;
  productSlug: string;
  categorySlug: string;
  name: string;
  packLabel: string;
  qty: number;
  unitPriceMinorUnits: bigint;
  vatRateBps: number;
  lineExVat: bigint;
  lineVat: bigint;
  available: number;
  madeToOrder: boolean;
  /** True when the product was withdrawn or reviewed-out after being added. */
  unavailable: boolean;
}

export interface CartSummary {
  id: string;
  token: string;
  lines: CartLine[];
  itemCount: number;
  subtotalMinorUnits: bigint;
  vatMinorUnits: bigint;
  totalMinorUnits: bigint;
  weightGrams: number;
}

export class CartError extends Error {
  constructor(
    public code: "NOT_FOUND" | "QTY" | "STOCK" | "UNAVAILABLE",
    message: string,
  ) {
    super(message);
  }
}

export function newToken(): string {
  return randomBytes(24).toString("base64url");
}

export function summarise(cart: CartRecord, customPriceMap?: Map<string, bigint>): CartSummary {
  const lines: CartLine[] = cart.items.map((it) => {
    const v = it.variant;
    const unit = customPriceMap?.get(v.id) ?? v.priceMinorUnits;
    const lineExVat = money.times(unit, it.qty);
    const p = v.product;
    return {
      id: it.id,
      variantId: v.id,
      sku: v.sku,
      productSlug: p.slug,
      categorySlug: p.category.parent?.slug ?? p.category.slug,
      name: p.name,
      packLabel: v.packLabel,
      qty: it.qty,
      unitPriceMinorUnits: unit,
      vatRateBps: v.vatRateBps,
      lineExVat,
      lineVat: money.vatOn(lineExVat, v.vatRateBps),
      available: v.stockOnHand - v.stockReserved,
      madeToOrder: v.isMadeToOrder,
      unavailable: !v.isActive || !p.isActive || p.needsPoReview,
    };
  });
  const subtotal = money.sum(lines.filter((l) => !l.unavailable).map((l) => l.lineExVat));
  const vat = money.sum(lines.filter((l) => !l.unavailable).map((l) => l.lineVat));
  return {
    id: cart.id,
    token: cart.token,
    lines,
    itemCount: lines.filter((l) => !l.unavailable).reduce((n, l) => n + l.qty, 0),
    subtotalMinorUnits: subtotal,
    vatMinorUnits: vat,
    totalMinorUnits: subtotal + vat,
    weightGrams: cart.items.reduce((g, it) => g + (it.variant.weightGrams ?? 0) * it.qty, 0),
  };
}

export class CartService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * The customer's negotiated prices for the packs in this cart, so the cart shows what checkout will
   * charge. Uses the same resolver the order transaction uses (tiers by quantity, active lists only),
   * because the two must never disagree.
   */
  private async customerPrices(customerId: string | null | undefined, cart: CartRecord): Promise<Map<string, bigint>> {
    if (!customerId || cart.items.length === 0) return new Map();
    const priceListId = await priceListFor(this.prisma, customerId);
    if (!priceListId) return new Map();
    return resolvePrices(
      this.prisma,
      priceListId,
      cart.items.map((i) => ({ variantId: i.variantId, qty: i.qty, listPriceMinorUnits: i.variant.priceMinorUnits })),
    );
  }

  async find(token: string, customerId?: string): Promise<CartSummary | null> {
    const cart = await this.prisma.cart.findFirst({ where: { token, expiresAt: { gt: new Date() } }, include: cartInclude });
    if (!cart) return null;
    return summarise(cart, await this.customerPrices(customerId ?? cart.customerId, cart));
  }

  async getOrCreate(token: string | undefined, userId?: string): Promise<CartSummary> {
    const existing = token ? await this.prisma.cart.findFirst({ where: { token, expiresAt: { gt: new Date() } }, include: cartInclude }) : null;
    if (existing) return summarise(existing);
    const created = await this.prisma.cart.create({
      data: { token: newToken(), userId: userId ?? null, expiresAt: expiry() },
      include: cartInclude,
    });
    return summarise(created);
  }

  private async assertAvailable(variantId: string, qty: number) {
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) throw new CartError("QTY", `Quantity must be between 1 and ${MAX_QTY}.`);
    // Someone else's abandoned checkout must not hold this pack past its window (see reservations.ts).
    await releaseExpiredReservations(this.prisma, { variantIds: [variantId] });
    const v = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      select: { isActive: true, stockOnHand: true, stockReserved: true, isMadeToOrder: true, packLabel: true, product: { select: { name: true, isActive: true, needsPoReview: true } } },
    });
    if (!v || !v.isActive || !v.product.isActive || v.product.needsPoReview) throw new CartError("UNAVAILABLE", "That product is not available to order online.");
    const available = v.stockOnHand - v.stockReserved;
    if (!v.isMadeToOrder && qty > available) {
      throw new CartError("STOCK", available > 0 ? `Only ${available} × ${v.product.name} ${v.packLabel} available right now.` : `${v.product.name} ${v.packLabel} is out of stock. Ask us when it is back.`);
    }
    return v;
  }

  /** Adds `qty` to the existing line (or creates it). Returns the updated cart. */
  async add(token: string, variantId: string, qty: number): Promise<CartSummary> {
    const cart = await this.prisma.cart.findFirst({ where: { token, expiresAt: { gt: new Date() } }, select: { id: true } });
    if (!cart) throw new CartError("NOT_FOUND", "Your cart has expired. Start a new one.");
    const current = await this.prisma.cartItem.findUnique({ where: { cartId_variantId: { cartId: cart.id, variantId } }, select: { qty: true } });
    const target = (current?.qty ?? 0) + qty;
    await this.assertAvailable(variantId, target);
    await this.prisma.cartItem.upsert({
      where: { cartId_variantId: { cartId: cart.id, variantId } },
      create: { cartId: cart.id, variantId, qty: target },
      update: { qty: target },
    });
    await this.prisma.cart.update({ where: { id: cart.id }, data: { expiresAt: expiry() } });
    return (await this.find(token))!;
  }

  /** Sets a line's quantity; 0 removes it. */
  async setQty(token: string, variantId: string, qty: number): Promise<CartSummary> {
    const cart = await this.prisma.cart.findFirst({ where: { token, expiresAt: { gt: new Date() } }, select: { id: true } });
    if (!cart) throw new CartError("NOT_FOUND", "Your cart has expired. Start a new one.");
    if (qty === 0) {
      await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id, variantId } });
    } else {
      await this.assertAvailable(variantId, qty);
      await this.prisma.cartItem.upsert({
        where: { cartId_variantId: { cartId: cart.id, variantId } },
        create: { cartId: cart.id, variantId, qty },
        update: { qty },
      });
    }
    return (await this.find(token))!;
  }

  /** Adds many lines at once (order sheet). Lines that fail are reported, the rest are added. */
  async addMany(token: string, lines: Array<{ variantId: string; qty: number }>): Promise<{ cart: CartSummary; failures: Array<{ variantId: string; message: string }> }> {
    const failures: Array<{ variantId: string; message: string }> = [];
    for (const l of lines) {
      try {
        await this.add(token, l.variantId, l.qty);
      } catch (e) {
        if (e instanceof CartError && e.code !== "NOT_FOUND") failures.push({ variantId: l.variantId, message: e.message });
        else throw e;
      }
    }
    return { cart: (await this.find(token))!, failures };
  }

  /** On login: move guest lines into the user's cart (quantities add up), then drop the guest cart. */
  async mergeInto(guestToken: string, userId: string): Promise<CartSummary> {
    const guest = await this.prisma.cart.findFirst({ where: { token: guestToken }, include: cartInclude });
    let userCart = await this.prisma.cart.findFirst({ where: { userId, expiresAt: { gt: new Date() } }, include: cartInclude });
    if (!userCart) {
      if (guest) {
        userCart = await this.prisma.cart.update({ where: { id: guest.id }, data: { userId }, include: cartInclude });
        return summarise(userCart);
      }
      return this.getOrCreate(undefined, userId);
    }
    if (guest && guest.id !== userCart.id) {
      for (const it of guest.items) {
        try {
          await this.add(userCart.token, it.variantId, it.qty);
        } catch (e) {
          if (!(e instanceof CartError)) throw e;
        }
      }
      await this.prisma.cart.delete({ where: { id: guest.id } });
    }
    return (await this.find(userCart.token))!;
  }
}

function expiry(): Date {
  return new Date(Date.now() + CART_TTL_DAYS * 86_400_000);
}
