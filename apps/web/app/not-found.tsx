import Link from "next/link";
import { site } from "@/config/site";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-24 sm:px-8">
      <p className="text-sm font-medium text-steel">404</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">That page does not exist</h1>
      <p className="mt-4 text-ink-muted">
        The new {site.shortName} site is still being built, so the address may have changed. Go back to the
        home page, or call {site.contact.phone.display} if you need something now.
      </p>
      <Link href="/" className="mt-8 inline-block rounded-md bg-steel px-4 py-2 font-medium text-white hover:bg-steel-deep">
        Go to home page
      </Link>
    </main>
  );
}
