import type { PrismaClient } from "@safuney/db";
import { KENYAN_COUNTIES, normaliseKenyanMobile } from "@safuney/config";

export class AddressError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "FORBIDDEN" | "INVALID",
    message: string,
  ) {
    super(message);
  }
}

export interface AddressInput {
  label?: string;
  recipientName: string;
  phone: string;
  county: string;
  town: string;
  line1?: string;
  landmark?: string;
  deliveryNotes?: string;
  isDefault?: boolean;
}

/**
 * Address book (master prompt Phase 5). Addresses belong to the customer record a user works with:
 * their organisation (shared by its members) or their personal record.
 */
export class AddressService {
  constructor(private readonly prisma: PrismaClient) {}

  async customerFor(userId: string): Promise<string> {
    const membership = await this.prisma.customerMember.findFirst({ where: { userId }, orderBy: { createdAt: "asc" }, include: { customer: { select: { id: true, type: true } } } });
    const org = membership?.customer.type === "ORGANISATION" ? membership.customer.id : null;
    if (org) return org;
    if (membership) return membership.customer.id;
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, email: true, phone: true } });
    const c = await this.prisma.customer.create({ data: { type: "INDIVIDUAL", displayName: user.name ?? user.email ?? user.phone ?? "Customer", members: { create: { userId, role: "OWNER" } } } });
    return c.id;
  }

  async listFor(userId: string) {
    const customerId = await this.customerFor(userId);
    return this.prisma.address.findMany({ where: { customerId }, orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }] });
  }

  private validate(input: AddressInput) {
    const phone = normaliseKenyanMobile(input.phone);
    if (!phone) throw new AddressError("INVALID", "That does not look like a Kenyan mobile number. Use 07xx xxx xxx or 01xx xxx xxx.");
    if (input.recipientName.trim().length < 2) throw new AddressError("INVALID", "Who receives the delivery? Enter a name.");
    if (!(KENYAN_COUNTIES as readonly string[]).includes(input.county)) throw new AddressError("INVALID", "Choose the county.");
    if (input.town.trim().length < 2) throw new AddressError("INVALID", "Enter the town, estate or area.");
    return { ...input, phone, recipientName: input.recipientName.trim(), town: input.town.trim(), label: input.label?.trim() || null, line1: input.line1?.trim() || null, landmark: input.landmark?.trim() || null, deliveryNotes: input.deliveryNotes?.trim() || null };
  }

  async create(userId: string, input: AddressInput) {
    const customerId = await this.customerFor(userId);
    const v = this.validate(input);
    const count = await this.prisma.address.count({ where: { customerId } });
    return this.prisma.$transaction(async (tx) => {
      const makeDefault = v.isDefault || count === 0;
      if (makeDefault) await tx.address.updateMany({ where: { customerId }, data: { isDefault: false } });
      return tx.address.create({ data: { customerId, label: v.label, recipientName: v.recipientName, phone: v.phone, county: v.county, town: v.town, line1: v.line1, landmark: v.landmark, deliveryNotes: v.deliveryNotes, isDefault: makeDefault } });
    });
  }

  private async owned(userId: string, id: string) {
    const customerId = await this.customerFor(userId);
    const a = await this.prisma.address.findUnique({ where: { id } });
    if (!a || a.customerId !== customerId) throw new AddressError("NOT_FOUND", "Address not found.");
    return a;
  }

  async update(userId: string, id: string, input: AddressInput) {
    const a = await this.owned(userId, id);
    const v = this.validate(input);
    return this.prisma.$transaction(async (tx) => {
      if (v.isDefault) await tx.address.updateMany({ where: { customerId: a.customerId }, data: { isDefault: false } });
      return tx.address.update({ where: { id }, data: { label: v.label, recipientName: v.recipientName, phone: v.phone, county: v.county, town: v.town, line1: v.line1, landmark: v.landmark, deliveryNotes: v.deliveryNotes, ...(v.isDefault ? { isDefault: true } : {}) } });
    });
  }

  async setDefault(userId: string, id: string) {
    const a = await this.owned(userId, id);
    await this.prisma.$transaction([this.prisma.address.updateMany({ where: { customerId: a.customerId }, data: { isDefault: false } }), this.prisma.address.update({ where: { id }, data: { isDefault: true } })]);
  }

  async remove(userId: string, id: string) {
    const a = await this.owned(userId, id);
    const inUse = await this.prisma.subscription.count({ where: { addressId: id, status: { not: "CANCELLED" } } });
    if (inUse > 0) throw new AddressError("INVALID", "A scheduled delivery uses this address. Change the schedule first.");
    await this.prisma.address.delete({ where: { id } });
    if (a.isDefault) {
      const next = await this.prisma.address.findFirst({ where: { customerId: a.customerId }, orderBy: { updatedAt: "desc" } });
      if (next) await this.prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  }
}
