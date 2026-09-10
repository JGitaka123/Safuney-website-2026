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
export function LanguageSwitcher({ tone = "light" }: { tone?: "light" | "dark" }) {
  const pathname = usePathname() ?? "/";
  const onSwahili = pathname === "/sw" || pathname.startsWith("/sw/");
  const english = onSwahili ? pathname.slice(3) || "/" : pathname;
  const swahili = onSwahili ? pathname : `/sw${pathname === "/" ? "" : pathname}`;
  // 44 px tall hit areas (plan §9): these sit at the foot of the page, right above the phone contact bar.
  const target = "inline-flex min-h-11 items-center px-1";
  const current = `${target} ${tone === "dark" ? "font-medium text-white" : "font-medium text-ink"}`;
  const other = `${target} ${tone === "dark" ? "text-white/70 hover:text-white hover:underline" : "text-ink-muted hover:underline"}`;

  return (
    <nav aria-label="Language" className="flex items-center gap-2 text-caption">
      <Link href={english} hrefLang="en" aria-current={onSwahili ? undefined : "page"} className={onSwahili ? other : current}>
        English
      </Link>
      <span aria-hidden className={tone === "dark" ? "text-white/30" : "text-line"}>
        |
      </span>
      <Link href={swahili} hrefLang="sw" aria-current={onSwahili ? "page" : undefined} className={onSwahili ? current : other}>
        Kiswahili
      </Link>
    </nav>
  );
}
