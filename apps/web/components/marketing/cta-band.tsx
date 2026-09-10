import Link from "next/link";
import { site } from "@/config/site";
import { telHref, whatsappHref } from "@/lib/contact";
import { btn } from "./buttons";
import { Icon } from "./icons";

interface CtaBandProps {
  id?: string;
  title?: string;
  body?: string;
  /** Opening line of the WhatsApp message, so the chat starts where the page left off. */
  whatsappText?: string;
  /** Where the quote button goes; defaults to the plain quote form. */
  quoteHref?: string;
}

/** The closing band on storefront pages: one headline and the three ways to reach a person. */
export function CtaBand({
  id = "cta-band",
  title = "Send your list. Get a price in one working day.",
  body = "Or tell us about the site and we will recommend what to use.",
  whatsappText = "Hello Safuney, I would like a quote for cleaning and hygiene products.",
  quoteHref = "/quote",
}: CtaBandProps) {
  return (
    <section aria-labelledby={id} className="on-dark bg-hero">
      <div className="mx-auto grid max-w-page gap-8 px-5 py-14 md:grid-cols-12 md:items-center md:px-6 md:py-20">
        <div className="md:col-span-7">
          <h2 id={id} className="text-h1 text-white">
            {title}
          </h2>
          <p className="mt-4 max-w-[58ch] text-body-lg text-white/75">{body}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row md:col-span-5 md:flex-col md:items-stretch lg:items-end">
          <Link href={quoteHref} className={`${btn.cta} lg:min-w-72`}>
            Get a quote
            <Icon name="arrowRight" className="size-5" />
          </Link>
          <a href={whatsappHref(whatsappText)} target="_blank" rel="noopener noreferrer" className={`${btn.whatsapp} lg:min-w-72`}>
            <Icon name="whatsapp" className="size-5" />
            Chat on WhatsApp
          </a>
          <a href={telHref} className="inline-flex min-h-11 items-center justify-center gap-2 text-body text-white/85 hover:text-white hover:underline lg:min-w-72">
            <Icon name="phone" className="size-4" />
            Call {site.contact.phone.display}
          </a>
        </div>
      </div>
    </section>
  );
}
