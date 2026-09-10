"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { telHref, whatsappHref } from "@/lib/contact";
import { Icon } from "./icons";

/** Where a buyer is already mid-task, or where staff work: no floating contact controls there. */
const HIDDEN = ["/checkout", "/cart", "/admin", "/warehouse", "/sales", "/reps", "/sign-in", "/account", "/orders", "/quotes", "/design"];

const GREETING = "Hello Safuney, I would like a price for cleaning and hygiene products.";

/**
 * The always-there way to reach a person (ADR 0017). On a phone: a bar across the bottom with Call,
 * WhatsApp and Get a quote — most Kenyan trade buyers read this site on a phone and would rather tap
 * than type. On a desktop: one WhatsApp button in the corner. Both live in one landmark.
 */
export function ContactDock() {
  const pathname = usePathname() ?? "/";
  if (HIDDEN.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  return (
    <nav aria-label="Quick contact">
      <a
        href={whatsappHref(GREETING)}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-40 hidden h-13 items-center gap-2 rounded-full bg-whatsapp pl-4 pr-5 text-button font-medium text-ink shadow-float transition-transform hover:-translate-y-0.5 md:inline-flex"
      >
        <Icon name="whatsapp" className="size-6" />
        Chat on WhatsApp
      </a>

      <ul className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-[1fr_1fr_1.4fr] gap-2 border-t border-line bg-surface px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-float md:hidden">
        <li>
          <a href={telHref} className="flex min-h-12 flex-col items-center justify-center rounded-button text-caption font-medium text-ink hover:bg-ground">
            <Icon name="phone" className="size-5" />
            Call
          </a>
        </li>
        <li>
          <a href={whatsappHref(GREETING)} target="_blank" rel="noopener noreferrer" className="flex min-h-12 flex-col items-center justify-center rounded-button text-caption font-medium text-ink hover:bg-ground">
            <Icon name="whatsapp" className="size-5 text-[#128c4a]" />
            WhatsApp
          </a>
        </li>
        <li>
          <Link href="/quote" className="flex min-h-12 items-center justify-center gap-1.5 rounded-button bg-cta px-3 text-button font-medium text-ink hover:bg-cta-hover">
            Get a quote
            <Icon name="arrowRight" className="size-4" />
          </Link>
        </li>
      </ul>
    </nav>
  );
}
