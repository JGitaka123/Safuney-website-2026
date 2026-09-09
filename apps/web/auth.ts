import NextAuth, { type DefaultSession } from "next-auth";
import type { UserRole } from "@safuney/db";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import Resend from "next-auth/providers/resend";
import { db } from "@safuney/db";
import { config, services } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { authMockMode } from "@/lib/auth/mode";
import { otpIdentifierForEmail, otpIdentifierForPhone, verifyOtp } from "@/lib/auth/otp";
import { verifyPassword, verifyTotp } from "@/lib/auth/password";

declare module "next-auth" {
  interface Session {
    user: { id: string; role: UserRole } & DefaultSession["user"];
  }
  interface User {
    role?: UserRole;
  }
}

/** Where a magic link lands; the page merges the guest cart and sets the header cookie. */
export const AFTER_SIGN_IN_PATH = "/api/account/landed";

/**
 * Auth.js v5 (ADR 0008). Customers sign in with an emailed link or a one-time code (SMS or email);
 * staff with email + password + TOTP. Sessions are JWTs (the credentials providers need it) with the
 * user id and role; anything sensitive is read from the database per request, never from the token.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  // Built only when a database is configured: this module is imported while the pages are collected at
  // build time, where there is no connection string, and db() throws without one.
  adapter: services.database() ? PrismaAdapter(db()) : undefined,
  // Auth.js reads AUTH_SECRET itself; naming it here keeps the failure legible when it is missing.
  // `||` not `??`: a variable set to an empty string must fail like a missing one, not be used as a key.
  secret: process.env["AUTH_SECRET"] || undefined,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  trustHost: true,
  pages: { signIn: "/sign-in", verifyRequest: "/sign-in/check-email", error: "/sign-in" },
  providers: [
    Resend({
      apiKey: process.env["RESEND_API_KEY"] ?? "not-configured",
      from: config.emailFrom,
      maxAge: 15 * 60,
      async sendVerificationRequest({ identifier, url }) {
        if (authMockMode() && !services.email()) {
          console.info(`[auth mock] magic link for ${identifier}: ${url}`);
          return;
        }
        const r = await sendEmail({
          to: identifier,
          subject: "Your Safuney sign-in link",
          text: `Sign in to Safuney:\n\n${url}\n\nThe link works once and expires in 15 minutes. If you did not ask for it, ignore this email.`,
        });
        if (!r.sent) throw new Error(`Sign-in email not sent: ${r.reason}`);
      },
    }),
    Credentials({
      id: "otp",
      name: "One-time code",
      credentials: { identifier: {}, code: {} },
      async authorize(raw) {
        const target = String(raw.identifier ?? "");
        const code = String(raw.code ?? "");
        const identifier = target.includes("@") ? otpIdentifierForEmail(target) : otpIdentifierForPhone(target);
        if (!identifier || !/^\d{6}$/.test(code)) return null;
        const v = await verifyOtp(identifier, code);
        if (!v.ok) return null;
        const [kind, value] = identifier.split(":", 2) as ["phone" | "email", string];
        const now = new Date();
        const user =
          kind === "phone"
            ? await db().user.upsert({ where: { phone: value }, create: { phone: value, phoneVerified: now }, update: { phoneVerified: now } })
            : await db().user.upsert({ where: { email: value }, create: { email: value, emailVerified: now }, update: { emailVerified: now } });
        if (!user.isActive) return null;
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
    Credentials({
      id: "staff",
      name: "Staff",
      credentials: { email: {}, password: {}, totp: {} },
      async authorize(raw) {
        const email = String(raw.email ?? "").trim().toLowerCase();
        const password = String(raw.password ?? "");
        const totp = String(raw.totp ?? "");
        if (!email || !password) return null;
        const user = await db().user.findUnique({ where: { email } });
        if (!user || !user.isActive || user.role === "CUSTOMER" || user.role === "B2B_BUYER" || user.role === "B2B_APPROVER") return null;
        if (!verifyPassword(password, user.passwordHash)) return null;
        // 2FA is mandatory for staff once enrolled; an un-enrolled account can only be used to enrol (Phase 6 admin).
        if (user.totpSecret && !verifyTotp(user.totpSecret, totp)) return null;
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token["uid"] = user.id;
        token["role"] = user.role ?? "CUSTOMER";
      } else if (trigger === "update" && token["uid"]) {
        const fresh = await db().user.findUnique({ where: { id: String(token["uid"]) }, select: { role: true, isActive: true } });
        token["role"] = fresh?.role ?? "CUSTOMER";
        if (fresh && !fresh.isActive) return null;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = String(token["uid"] ?? "");
      session.user.role = (token["role"] as UserRole | undefined) ?? "CUSTOMER";
      return session;
    },
  },
});
