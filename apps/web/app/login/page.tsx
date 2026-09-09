import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/config/site";
import { getCurrentSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "B2B Account Login",
  description: `Sign in to your ${site.legalName} corporate account to access credit ordering, custom pricing, and order approvals.`,
};

export default async function LoginPage() {
  const session = await getCurrentSession();
  if (session) {
    redirect("/account");
  }

  return (
    <div className="mx-auto max-w-page px-5 py-12 md:px-6 md:py-20">
      <div className="mx-auto max-w-md">
        <nav aria-label="Breadcrumb" className="text-small text-ink-muted">
          <Link href="/" className="hover:underline underline-offset-[3px]">
            Home
          </Link>
          <span aria-hidden> / </span>
          <span aria-current="page">Account login</span>
        </nav>

        <h1 className="mt-4 text-h2 font-semibold text-ink">B2B Account Login</h1>
        <p className="mt-2 text-small text-ink-muted">
          Access your organisation&apos;s credit terms, purchase order approvals, and invoice records.
        </p>

        <div className="mt-8 rounded-chip border border-line bg-surface p-6 sm:p-8">
          <LoginForm />
        </div>

        <div className="mt-6 rounded-chip border border-line bg-ground p-6 text-center">
          <p className="text-small text-ink">Does your organisation need credit terms?</p>
          <p className="mt-1 text-small text-ink-muted">
            Apply for a 30-day corporate credit account with KRA-compliant eTIMS invoicing.
          </p>
          <div className="mt-4">
            <Link
              href="/account/credit-application"
              className="inline-flex min-h-11 items-center justify-center rounded-button border border-stainless bg-surface px-4 text-button text-ink hover:bg-ground-deep"
            >
              Apply for credit account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
