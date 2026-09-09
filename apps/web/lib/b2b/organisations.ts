import type { MemberRole, PrismaClient } from "@safuney/db";

export class OrganisationError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "FORBIDDEN" | "INVALID" | "EXISTS",
    message: string,
  ) {
    super(message);
  }
}

const KRA_PIN = /^[AP]\d{9}[A-Z]$/i;

/**
 * Organisation accounts (master prompt Phase 4): a Customer of type ORGANISATION with members who are
 * owners, buyers or approvers. Every mutation checks the caller's membership; the audit trail is the
 * AuditLog (actor, before/after) so Phase 6 admin sees the same history.
 */
export class OrganisationService {
  constructor(private readonly prisma: PrismaClient) {}

  async create(ownerUserId: string, input: { displayName: string; legalName?: string; kraPin?: string; approvalThresholdMinorUnits?: bigint | null }) {
    const displayName = input.displayName.trim();
    if (displayName.length < 2) throw new OrganisationError("INVALID", "Enter the organisation's name.");
    if (input.kraPin && !KRA_PIN.test(input.kraPin.trim())) throw new OrganisationError("INVALID", "A KRA PIN is a letter, nine digits and a letter, for example P051234567X.");
    const customer = await this.prisma.$transaction(async (tx) => {
      const c = await tx.customer.create({
        data: {
          type: "ORGANISATION",
          displayName,
          legalName: input.legalName?.trim() || null,
          kraPin: input.kraPin?.trim().toUpperCase() || null,
          approvalThresholdMinorUnits: input.approvalThresholdMinorUnits ?? null,
          members: { create: { userId: ownerUserId, role: "OWNER" } },
        },
      });
      await tx.auditLog.create({ data: { actorId: ownerUserId, action: "organisation.create", entity: "Customer", entityId: c.id, after: { displayName, kraPin: c.kraPin } } });
      return c;
    });
    return customer;
  }

  async membership(customerId: string, userId: string) {
    return this.prisma.customerMember.findUnique({ where: { customerId_userId: { customerId, userId } } });
  }

  private async requireOwner(customerId: string, userId: string) {
    const m = await this.membership(customerId, userId);
    if (!m) throw new OrganisationError("NOT_FOUND", "Organisation not found.");
    if (m.role !== "OWNER") throw new OrganisationError("FORBIDDEN", "Only an owner can change the organisation's settings and members.");
    return m;
  }

  /** Invites by email: the user record is created if needed; they get a role the moment they sign in with that email. */
  async invite(customerId: string, byUserId: string, email: string, role: MemberRole) {
    await this.requireOwner(customerId, byUserId);
    const e = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new OrganisationError("INVALID", "Enter the colleague's work email address.");
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.upsert({ where: { email: e }, create: { email: e }, update: {} });
      const existing = await tx.customerMember.findUnique({ where: { customerId_userId: { customerId, userId: user.id } } });
      if (existing) throw new OrganisationError("EXISTS", "That person is already a member.");
      const m = await tx.customerMember.create({ data: { customerId, userId: user.id, role } });
      await tx.auditLog.create({ data: { actorId: byUserId, action: "organisation.member.invite", entity: "CustomerMember", entityId: m.id, after: { email: e, role } } });
      return m;
    });
  }

  async setMemberRole(customerId: string, byUserId: string, memberUserId: string, role: MemberRole) {
    await this.requireOwner(customerId, byUserId);
    const owners = await this.prisma.customerMember.count({ where: { customerId, role: "OWNER" } });
    const target = await this.membership(customerId, memberUserId);
    if (!target) throw new OrganisationError("NOT_FOUND", "That member was not found.");
    if (target.role === "OWNER" && role !== "OWNER" && owners <= 1) throw new OrganisationError("INVALID", "An organisation needs at least one owner.");
    return this.prisma.$transaction(async (tx) => {
      const m = await tx.customerMember.update({ where: { id: target.id }, data: { role } });
      await tx.auditLog.create({ data: { actorId: byUserId, action: "organisation.member.role", entity: "CustomerMember", entityId: m.id, before: { role: target.role }, after: { role } } });
      return m;
    });
  }

  async removeMember(customerId: string, byUserId: string, memberUserId: string) {
    await this.requireOwner(customerId, byUserId);
    const target = await this.membership(customerId, memberUserId);
    if (!target) throw new OrganisationError("NOT_FOUND", "That member was not found.");
    const owners = await this.prisma.customerMember.count({ where: { customerId, role: "OWNER" } });
    if (target.role === "OWNER" && owners <= 1) throw new OrganisationError("INVALID", "An organisation needs at least one owner.");
    await this.prisma.$transaction(async (tx) => {
      await tx.customerMember.delete({ where: { id: target.id } });
      await tx.auditLog.create({ data: { actorId: byUserId, action: "organisation.member.remove", entity: "CustomerMember", entityId: target.id, before: { userId: memberUserId, role: target.role } } });
    });
  }

  async updateSettings(customerId: string, byUserId: string, input: { displayName?: string; legalName?: string | null; kraPin?: string | null; approvalThresholdMinorUnits?: bigint | null }) {
    await this.requireOwner(customerId, byUserId);
    if (input.kraPin && !KRA_PIN.test(input.kraPin.trim())) throw new OrganisationError("INVALID", "A KRA PIN is a letter, nine digits and a letter, for example P051234567X.");
    const before = await this.prisma.customer.findUniqueOrThrow({ where: { id: customerId }, select: { displayName: true, legalName: true, kraPin: true, approvalThresholdMinorUnits: true } });
    return this.prisma.$transaction(async (tx) => {
      const c = await tx.customer.update({
        where: { id: customerId },
        data: {
          ...(input.displayName !== undefined ? { displayName: input.displayName.trim() } : {}),
          ...(input.legalName !== undefined ? { legalName: input.legalName?.trim() || null } : {}),
          ...(input.kraPin !== undefined ? { kraPin: input.kraPin?.trim().toUpperCase() || null } : {}),
          ...(input.approvalThresholdMinorUnits !== undefined ? { approvalThresholdMinorUnits: input.approvalThresholdMinorUnits } : {}),
        },
      });
      await tx.auditLog.create({ data: { actorId: byUserId, action: "organisation.update", entity: "Customer", entityId: customerId, before: { ...before, approvalThresholdMinorUnits: before.approvalThresholdMinorUnits?.toString() ?? null }, after: { displayName: c.displayName, legalName: c.legalName, kraPin: c.kraPin, approvalThresholdMinorUnits: c.approvalThresholdMinorUnits?.toString() ?? null } } });
      return c;
    });
  }

  /**
   * Credit application (Phase 4 onboarding). Documents are references to uploaded files (Vercel Blob
   * when configured); without uploads the application still goes in and finance asks for documents by
   * email. Approval itself is a staff action (Phase 6 admin UI; the service method lives here).
   */
  async applyForCredit(customerId: string, byUserId: string, input: { legalName: string; kraPin: string; requestedLimitMinorUnits: bigint; requestedTermsDays: number; tradeReferences: Array<{ company: string; contact: string; phone: string }>; documents: Array<{ name: string; fileUrl: string }> }) {
    await this.requireOwner(customerId, byUserId);
    if (input.legalName.trim().length < 2) throw new OrganisationError("INVALID", "Enter the registered company name.");
    if (!KRA_PIN.test(input.kraPin.trim())) throw new OrganisationError("INVALID", "A KRA PIN is a letter, nine digits and a letter, for example P051234567X.");
    if (input.requestedLimitMinorUnits <= 0n) throw new OrganisationError("INVALID", "Enter the credit limit you are asking for.");
    if (![14, 30, 45, 60].includes(input.requestedTermsDays)) throw new OrganisationError("INVALID", "Choose 14, 30, 45 or 60 days.");
    if (input.tradeReferences.length < 1) throw new OrganisationError("INVALID", "Give at least one trade reference we can call.");
    const open = await this.prisma.creditApplication.findFirst({ where: { customerId, status: "PENDING" } });
    if (open) throw new OrganisationError("EXISTS", "An application is already being reviewed. We will email you when it is decided.");
    return this.prisma.$transaction(async (tx) => {
      const app = await tx.creditApplication.create({ data: { customerId, legalName: input.legalName.trim(), kraPin: input.kraPin.trim().toUpperCase(), tradeReferences: input.tradeReferences, documents: input.documents, requestedLimitMinorUnits: input.requestedLimitMinorUnits, requestedTermsDays: input.requestedTermsDays } });
      await tx.customer.update({ where: { id: customerId }, data: { legalName: input.legalName.trim(), kraPin: input.kraPin.trim().toUpperCase(), status: "PENDING_CREDIT_APPROVAL" } });
      await tx.auditLog.create({ data: { actorId: byUserId, action: "credit.apply", entity: "CreditApplication", entityId: app.id, after: { requestedLimitMinorUnits: input.requestedLimitMinorUnits.toString(), requestedTermsDays: input.requestedTermsDays } } });
      return app;
    });
  }

  /** Staff decision. Approval sets the limit and terms and switches invoice payment on. */
  async decideCredit(applicationId: string, staffUserId: string, decision: { approved: boolean; limitMinorUnits?: bigint; termsDays?: number; note?: string }) {
    const staff = await this.prisma.user.findUnique({ where: { id: staffUserId }, select: { role: true } });
    if (!staff || !["FINANCE", "ADMIN"].includes(staff.role)) throw new OrganisationError("FORBIDDEN", "Only finance or admin staff can decide credit applications.");
    const app = await this.prisma.creditApplication.findUnique({ where: { id: applicationId } });
    if (!app) throw new OrganisationError("NOT_FOUND", "Application not found.");
    if (app.status !== "PENDING") throw new OrganisationError("INVALID", "This application has already been decided.");
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.creditApplication.update({ where: { id: app.id }, data: { status: decision.approved ? "APPROVED" : "REJECTED", decisionNote: decision.note ?? null, decidedAt: new Date() } });
      await tx.customer.update({
        where: { id: app.customerId },
        data: decision.approved
          ? { status: "CREDIT_APPROVED", creditLimitMinorUnits: decision.limitMinorUnits ?? app.requestedLimitMinorUnits, creditTermsDays: decision.termsDays ?? app.requestedTermsDays, approvedById: staffUserId, approvedAt: new Date() }
          : { status: "ACTIVE" },
      });
      await tx.auditLog.create({ data: { actorId: staffUserId, action: decision.approved ? "credit.approve" : "credit.reject", entity: "CreditApplication", entityId: app.id, after: { limitMinorUnits: (decision.limitMinorUnits ?? app.requestedLimitMinorUnits).toString(), termsDays: decision.termsDays ?? app.requestedTermsDays, note: decision.note ?? null } } });
      return updated;
    });
  }
}
