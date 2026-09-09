import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Check your email", robots: { index: false } };

export default function CheckEmailPage() {
  return (
    <div className="mx-auto max-w-page px-5 py-10 md:px-6 md:py-16">
      <div className="mx-auto max-w-lg">
        <h1 className="text-h1">Check your email</h1>
        <p className="mt-3 text-body text-ink">We sent you a sign-in link. It works once and expires in 15 minutes.</p>
        <p className="mt-2 text-small text-ink-muted">
          Nothing arrived? Look in spam, or{" "}
          <Link href="/sign-in" className="text-accent underline underline-offset-[3px]">
            ask for a code by SMS
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
