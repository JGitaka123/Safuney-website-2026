import { site } from "@/config/site";
import { telHref, whatsappHref } from "@/lib/contact";
import { Icon } from "@/components/marketing/icons";

/**
 * The announcement line above the header (Alliance Chemical's "Call … or email … · Most stocked orders
 * ship in 1–2 business days"): how to reach a person, and the one service promise the company already
 * stands behind. The day-count delivery promise stays out until `delivery.poConfirmed`.
 */
export function UtilityBar() {
  const { contact, delivery } = site;
  return (
    <div className="on-dark bg-night text-white/85">
      <div className="mx-auto flex min-h-9 max-w-page items-center justify-center gap-x-4 gap-y-1 px-5 py-1.5 text-caption md:justify-between md:px-6">
        <p className="text-center">
          Call{" "}
          <a href={telHref} className="font-medium text-white underline underline-offset-2">
            {contact.phone.display}
          </a>
          <span className="hidden sm:inline">
            {" "}
            or email{" "}
            <a href={`mailto:${contact.email.address}`} className="font-medium text-white underline underline-offset-2">
              {contact.email.address}
            </a>
          </span>
          <span className="hidden lg:inline"> · Priced within one working day · {delivery.poConfirmed ? delivery.promise : "Delivery across Kenya"}</span>
        </p>
        <a href={whatsappHref()} target="_blank" rel="noopener noreferrer" className="hidden items-center gap-1.5 font-medium text-white hover:underline md:inline-flex">
          <Icon name="whatsapp" className="size-3.5 text-whatsapp" />
          WhatsApp {contact.phone.display}
        </a>
      </div>
    </div>
  );
}
