import { site } from "@/config/site";
import { telHref, whatsappHref } from "@/lib/contact";
import { Icon } from "@/components/marketing/icons";

/**
 * The thin bar above the header: the three things a trade buyer wants settled before looking at a
 * single product, and the two ways to reach a person.
 *
 * Only claims the company already stands behind appear here. The delivery promise with day counts in
 * config/site.ts is still awaiting the PO (`poConfirmed: false`), so until then the bar says where we
 * deliver, not how fast.
 */
export function UtilityBar() {
  const { contact, delivery, company } = site;
  const claims = [
    company.etims ? "eTIMS-compliant supplier" : null,
    delivery.poConfirmed ? delivery.promise : "Delivery across Kenya",
    "Quotes within 1 working day",
  ].filter((c): c is string => Boolean(c));

  return (
    <div className="on-dark hidden bg-night text-white/80 md:block">
      <div className="mx-auto flex h-9 max-w-page items-center justify-between gap-6 px-6 text-caption">
        <ul className="flex min-w-0 items-center gap-5">
          {claims.map((c) => (
            <li key={c} className="flex items-center gap-1.5 truncate">
              <Icon name="check" className="size-3.5 shrink-0 text-brand-lime" />
              {c}
            </li>
          ))}
        </ul>
        <div className="flex shrink-0 items-center gap-5">
          <a href={telHref} className="inline-flex items-center gap-1.5 font-medium text-white hover:underline">
            <Icon name="phone" className="size-3.5" />
            {contact.phone.display}
          </a>
          <a href={whatsappHref()} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-medium text-white hover:underline">
            <Icon name="whatsapp" className="size-3.5 text-whatsapp" />
            WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
