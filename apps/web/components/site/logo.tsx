import Link from "next/link";
import { site } from "@/config/site";

/** Interim wordmark until the PO supplies a logo file (question 5). */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2 text-ink ${className}`} aria-label={`${site.legalName} home`}>
      <span aria-hidden className="grid size-8 place-items-center bg-ink text-white">
        <svg width="20" height="20" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round">
          <path d="M43 21c-2-4-7-6-11-6-7 0-11 4-11 9 0 5 4 7 10 8l4 1c5 1 7 3 7 6 0 4-4 6-9 6-5 0-9-2-11-6" />
        </svg>
      </span>
      <span className="text-h4 tracking-tight">{site.shortName}</span>
    </Link>
  );
}
