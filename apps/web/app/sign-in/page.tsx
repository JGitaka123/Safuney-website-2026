import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { viewer } from "@/lib/auth/session";
import { authMockMode } from "@/lib/auth/mode";
import { safeNextPath } from "@/lib/auth/after-sign-in";
import { services } from "@/lib/env";
import { smsConfigured } from "@/lib/notify";
import { SignInForm } from "@/components/account/sign-in-form";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; expired?: string }> }) {
  const { next, expired } = await searchParams;
  const target = safeNextPath(next);
  if (await viewer()) redirect(target);
  return (
    <div className="mx-auto max-w-page px-5 py-10 md:px-6 md:py-16">
      <div className="mx-auto max-w-lg">
        <h1 className="text-h1">Sign in</h1>
        <p className="mt-2 text-body text-ink-muted">See your orders, reorder in one tap and manage your organisation&rsquo;s account.</p>
        <div className="mt-8 border border-line bg-surface p-6 md:p-8">
          <SignInForm next={target} mockMode={authMockMode()} smsAvailable={smsConfigured()} emailAvailable={services.email() || authMockMode()} expired={expired === "1"} />
        </div>
        <p className="mt-6 text-small text-ink-muted">
          Safuney staff:{" "}
          <Link href="/sign-in/staff" className="text-accent underline underline-offset-[3px]">
            sign in with your password
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
