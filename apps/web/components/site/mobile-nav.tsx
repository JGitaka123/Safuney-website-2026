"use client";

import { useState } from "react";
import Link from "next/link";
import { Sheet } from "@safuney/ui";
import { site } from "@/config/site";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Menu"
        description="Site navigation"
        trigger={
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-button text-ink hover:bg-ground-deep"
            aria-label="Open menu"
          >
            <svg aria-hidden width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 6h16M3 11h16M3 16h16" />
            </svg>
          </button>
        }
      >
        <nav aria-label="Primary" className="flex h-full flex-col">
          <ul className="flex flex-col py-2">
            {site.nav.primary.map((item) => (
              <li key={item.href}>
                <Link href={item.href} onClick={() => setOpen(false)} className="flex min-h-12 items-center px-5 text-h4 font-medium hover:bg-ground-deep">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <ul className="border-t border-line py-2">
            {site.nav.help.map((item) => (
              <li key={item.href}>
                <Link href={item.href} onClick={() => setOpen(false)} className="flex min-h-11 items-center px-5 text-body text-ink hover:bg-ground-deep">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-auto flex flex-col gap-3 border-t border-line p-5">
            <a href={`tel:${site.contact.phone.e164}`} className="inline-flex min-h-11 items-center justify-center rounded-button bg-ink px-4 text-button text-white">
              Call {site.contact.phone.display}
            </a>
            <a
              href={`https://wa.me/${site.contact.whatsapp.e164}`}
              className="inline-flex min-h-11 items-center justify-center rounded-button border border-stainless bg-surface px-4 text-button text-ink"
            >
              WhatsApp
            </a>
          </div>
        </nav>
      </Sheet>
    </div>
  );
}
