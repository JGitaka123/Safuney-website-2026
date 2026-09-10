"use client";

import { useState } from "react";
import Link from "next/link";
import { Sheet } from "@safuney/ui";
import { site } from "@/config/site";
import { telHref, whatsappHref } from "@/lib/contact";
import { btn } from "@/components/marketing/buttons";
import { Icon } from "@/components/marketing/icons";

/** The phone menu. `tone="dark"` for the trigger on the blue masthead. */
export function MobileNav({ tone = "light" }: { tone?: "light" | "dark" }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const colours = tone === "dark" ? "text-white hover:bg-white/10" : "text-ink hover:bg-ground-deep";
  return (
    <div className="md:hidden">
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Menu"
        description="Site navigation"
        trigger={
          <button type="button" className={`inline-flex size-11 items-center justify-center rounded-button ${colours}`} aria-label="Open menu">
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
                <Link href={item.href} onClick={close} className="flex min-h-12 items-center px-5 text-h4 font-medium hover:bg-ground-deep">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="border-t border-line px-5 py-4">
            <p className="text-label text-ink-muted">Shop by range</p>
            <ul className="mt-2 grid grid-cols-1 gap-1">
              {site.productAreas.map((area) => (
                <li key={area.slug}>
                  <Link href={`/products/${area.slug}`} onClick={close} className="flex min-h-11 items-center text-body text-ink hover:text-accent">
                    {area.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <ul className="border-t border-line py-2">
            {site.nav.help.map((item) => (
              <li key={item.href}>
                <Link href={item.href} onClick={close} className="flex min-h-11 items-center px-5 text-body text-ink hover:bg-ground-deep">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-auto flex flex-col gap-3 border-t border-line p-5">
            <Link href="/quote" onClick={close} className={btn.cta}>
              Request a quote
              <Icon name="arrowRight" className="size-5" />
            </Link>
            <div className="grid grid-cols-2 gap-3">
              <a href={telHref} className={`${btn.secondary} px-3`}>
                <Icon name="phone" className="size-4" />
                Call
              </a>
              <a href={whatsappHref()} target="_blank" rel="noopener noreferrer" className={`${btn.whatsapp} px-3`}>
                <Icon name="whatsapp" className="size-4" />
                WhatsApp
              </a>
            </div>
          </div>
        </nav>
      </Sheet>
    </div>
  );
}
