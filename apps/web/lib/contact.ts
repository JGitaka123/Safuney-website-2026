import { site } from "@/config/site";

/**
 * The three ways a buyer reaches a person, as links. Plain functions over config so both server and
 * client components can use them.
 */

/** Click-to-chat. `text` pre-fills the message so the conversation starts with what they were looking at. */
export function whatsappHref(text?: string): string {
  const base = `https://wa.me/${site.contact.whatsapp.e164}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export const telHref = `tel:${site.contact.phone.e164}`;

/** The quote form, pre-filled with the product (and pack) the visitor was looking at. */
export function quoteHref(params: { product?: string; pack?: string; category?: string } = {}): string {
  const qs = new URLSearchParams();
  if (params.product) qs.set("product", params.product);
  if (params.pack) qs.set("pack", params.pack);
  if (params.category) qs.set("category", params.category);
  const s = qs.toString();
  return s ? `/quote?${s}` : "/quote";
}

/** The opening line of a WhatsApp enquiry about one product. */
export function productEnquiry(name: string, pack?: string): string {
  return `Hello Safuney, please send me a price for ${name}${pack ? ` (${pack})` : ""}.`;
}
