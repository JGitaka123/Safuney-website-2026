"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * English ⇄ Kiswahili.
 *
 * Links rather than a select: the other language is a real URL that can be shared, bookmarked and
 * indexed, which is also what makes `hreflang` honest. The current language is marked with
 * `aria-current` rather than only by weight, so it is announced and not merely seen.
 *
 * Each label is written in its own language — someone looking for Kiswahili should not have to read
 * English to find it.
 */
export function LanguageSwitcher() {
  const pathname = usePathname() ?? "/";
  const onSwahili = pathname === "/sw" || pathname.startsWith("/sw/");
  const english = onSwahili ? pathname.slice(3) || "/" : pathname;
  const swahili = onSwahili ? pathname : `/sw${pathname === "/" ? "" : pathname}`;

  return (
    <nav aria-label="Language" className="flex items-center gap-3 text-caption">
      <Link href={english} hrefLang="en" aria-current={onSwahili ? undefined : "page"} className={onSwahili ? "text-ink-muted hover:underline" : "font-medium text-ink"}>
        English
      </Link>
      <span aria-hidden className="text-line">
        |
      </span>
      <Link href={swahili} hrefLang="sw" aria-current={onSwahili ? "page" : undefined} className={onSwahili ? "font-medium text-ink" : "text-ink-muted hover:underline"}>
        Kiswahili
      </Link>
    </nav>
  );
}
