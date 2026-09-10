import Link from "next/link";
import { site } from "@/config/site";

/**
 * The thin bar above the header.
 *
 * Trade supply sites in this category all carry one, and it does a specific job: it answers the three
 * questions a professional buyer asks before they look at a single product — when will it arrive, who
 * do I call, and do I already have an account. Putting those in the masthead is why the main header
 * can then be quiet.
 *
 * The technical line renders only when the PO has supplied one that differs from the sales line.
 * Printing the same number under two labels would fake the signal it exists to send.
 */
export function UtilityBar() {
  const { contact, delivery } = site;
  const technical = contact.technical.e164 && contact.technical.e164 !== contact.phone.e164 ? contact.technical : null;

  return (
    <div className="hidden border-b border-line bg-ground-deep md:block">
      <div className="mx-auto flex h-9 max-w-page items-center justify-between gap-6 px-6 text-caption text-ink-muted">
        <p className="truncate">
          <span className="font-medium text-ink">{delivery.promise}</span>
          {delivery.freeAbove ? <span> · free over {delivery.freeAbove}</span> : null}
        </p>
        <div className="flex shrink-0 items-center gap-5">
          <span>
            <span className="text-ink-muted">Sales and orders </span>
            <a href={`tel:${contact.phone.e164}`} className="font-medium text-ink hover:underline">
              {contact.phone.display}
            </a>
          </span>
          {technical ? (
            <span>
              <span className="text-ink-muted">Technical advice </span>
              <a href={`tel:${technical.e164}`} className="font-medium text-ink hover:underline">
                {technical.display}
              </a>
            </span>
          ) : null}
          <a
            href={`https://wa.me/${contact.whatsapp.e164}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-ink hover:underline"
          >
            WhatsApp
          </a>
          <Link href="/resources/safety-data-sheets" className="hover:underline">
            Safety data sheets
          </Link>
        </div>
      </div>
    </div>
  );
}
