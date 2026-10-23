import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Alert } from "@safuney/ui";
import { viewer } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/auth/after-sign-in";
import { StaffSignInForm } from "@/components/account/staff-sign-in-form";

export const metadata: Metadata = { title: "Staff sign in", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function StaffSignInPage({ searchParams }: { searchParams: Promise<{ next?: string; changed?: string }> }) {
  const { next, changed } = await searchParams;
  const target = safeNextPath(next, "/sales");
  if (await viewer()) redirect(target);
  return (
    <div className="mx-auto max-w-page px-5 py-10 md:px-6 md:py-16">
      <div className="mx-auto max-w-lg">
        <h1 className="text-h1">Staff sign in</h1>
        <p className="mt-2 text-body text-ink-muted">Sales, warehouse, finance and admin accounts.</p>
        {changed === "password" || changed === "authenticator" ? (
          <Alert variant="success" className="mt-6">
            {changed === "password" ? "Password changed." : "Authenticator changed; you can delete the old Safuney entry from your phone."} You have been signed out everywhere. Sign in with the new details.
          </Alert>
        ) : null}
        <div className="mt-8 border border-line bg-surface p-6 md:p-8">
          <StaffSignInForm next={target} />
        </div>
      </div>
    </div>
  );
}
