import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { db, isDatabaseConfigured, type MemberRole, type UserRole } from "@safuney/db";

export const SESSION_COOKIE = "sfn_session";
export const SESSION_TTL_DAYS = 30;

export interface AuthSession {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    role: UserRole;
  };
  customer: {
    id: string;
    displayName: string;
    legalName: string | null;
    kraPin: string | null;
    vatNumber: string | null;
    status: string;
    creditLimitMinorUnits: bigint;
    creditTermsDays: number;
    approvalThresholdMinorUnits: bigint | null;
    priceListId: string | null;
  } | null;
  memberRole: MemberRole | null;
  isB2B: boolean;
}

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function setSessionCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env["NODE_ENV"] === "production",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 86_400,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getSessionToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value ?? null;
}

/** Demo / mock session fallback for previews and when DB is not connected */
export const DEMO_B2B_SESSIONS: Record<string, AuthSession> = {
  "demo-buyer": {
    user: {
      id: "usr_sarova_buyer_01",
      name: "David Maina (Purchasing)",
      email: "procurement@sarova.co.ke",
      phone: "+254722000001",
      role: "B2B_BUYER",
    },
    customer: {
      id: "cust_sarova_hotels",
      displayName: "Sarova Hotels & Resorts",
      legalName: "Sarova Hotels Management Limited",
      kraPin: "P051123456Z",
      vatNumber: "0123456M",
      status: "CREDIT_APPROVED",
      creditLimitMinorUnits: 50000000n, // KES 500,000.00
      creditTermsDays: 30,
      approvalThresholdMinorUnits: 15000000n, // KES 150,000.00 approval limit
      priceListId: null,
    },
    memberRole: "BUYER",
    isB2B: true,
  },
  "demo-approver": {
    user: {
      id: "usr_sarova_fin_01",
      name: "Sarah Wanjiku (Finance Director)",
      email: "finance@sarova.co.ke",
      phone: "+254722000002",
      role: "B2B_APPROVER",
    },
    customer: {
      id: "cust_sarova_hotels",
      displayName: "Sarova Hotels & Resorts",
      legalName: "Sarova Hotels Management Limited",
      kraPin: "P051123456Z",
      vatNumber: "0123456M",
      status: "CREDIT_APPROVED",
      creditLimitMinorUnits: 50000000n, // KES 500,000.00
      creditTermsDays: 30,
      approvalThresholdMinorUnits: 15000000n,
      priceListId: null,
    },
    memberRole: "APPROVER",
    isB2B: true,
  },
};

export async function getCurrentSession(): Promise<AuthSession | null> {
  const token = await getSessionToken();
  if (!token) return null;

  // If token is one of the demo keys, return demo session
  if (token in DEMO_B2B_SESSIONS) {
    return DEMO_B2B_SESSIONS[token]!;
  }

  if (!isDatabaseConfigured()) {
    return null;
  }

  try {
    const prisma = db();
    const session = await prisma.session.findUnique({
      where: { sessionToken: token },
      include: {
        user: {
          include: {
            memberships: {
              include: {
                customer: true,
              },
              take: 1,
            },
          },
        },
      },
    });

    if (!session || session.expires < new Date() || !session.user.isActive) {
      return null;
    }

    const membership = session.user.memberships[0] ?? null;
    const customer = membership?.customer ?? null;

    return {
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        phone: session.user.phone,
        role: session.user.role,
      },
      customer: customer
        ? {
            id: customer.id,
            displayName: customer.displayName,
            legalName: customer.legalName,
            kraPin: customer.kraPin,
            vatNumber: customer.vatNumber,
            status: customer.status,
            creditLimitMinorUnits: customer.creditLimitMinorUnits,
            creditTermsDays: customer.creditTermsDays,
            approvalThresholdMinorUnits: customer.approvalThresholdMinorUnits,
            priceListId: customer.priceListId,
          }
        : null,
      memberRole: membership?.role ?? null,
      isB2B: !!customer,
    };
  } catch (err) {
    console.error("getCurrentSession error", err);
    return null;
  }
}
