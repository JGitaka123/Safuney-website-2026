/**
 * Swahili and English strings for the parts of the site a customer must be able to read in either
 * language: navigation, the cart and checkout, and the key pages.
 *
 * One catalogue with both languages side by side rather than two files, so a missing translation is
 * visible in review instead of appearing months later as an English string on a Swahili page. The
 * types make a missing key a build error; `guard:i18n` catches a key that reached the rendered HTML.
 *
 * Kenyan Swahili as it is actually used in commerce: "oda" for an order, "lipa" for pay, and English
 * loanwords where the loanword is what people say. Translating "cart" as "kikapu" would be more
 * correct and less understood.
 */
export const LOCALES = ["en", "sw"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

const en = {
  "nav.products": "Products",
  "nav.solutions": "Solutions",
  "nav.services": "Services",
  "nav.resources": "Resources",
  "nav.about": "About",
  "nav.contact": "Contact",
  "nav.account": "Account",
  "nav.cart": "Cart",
  "nav.signIn": "Sign in",
  "nav.search": "Search products, SKUs and documents",
  "nav.skip": "Skip to main content",

  "home.title": "Professional cleaning chemicals, supplied with the know-how to use them correctly.",
  "home.lead":
    "Concentrates, disinfectants, laundry and hand hygiene for kitchens, wards, washrooms and laundries in Kenya, with dilution ratios, contact times and safety data on every product.",
  "home.browse": "Browse products",
  "home.quote": "Request a quote",

  "zones.heading": "Where will you use it?",
  "zone.RED": "Washrooms",
  "zone.BLUE": "General areas",
  "zone.GREEN": "Kitchen and food prep",
  "zone.YELLOW": "Clinical and isolation",

  "cart.title": "Your cart",
  "cart.empty": "Your cart is empty.",
  "cart.subtotal": "Subtotal",
  "cart.vat": "VAT",
  "cart.delivery": "Delivery",
  "cart.total": "Total",
  "cart.checkout": "Checkout",
  "cart.continue": "Keep shopping",
  "cart.remove": "Remove",
  "cart.quantity": "Quantity",

  "checkout.title": "Checkout",
  "checkout.contact": "Your details",
  "checkout.delivery": "Delivery",
  "checkout.payment": "Payment",
  "checkout.review": "Review",
  "checkout.name": "Full name",
  "checkout.email": "Email address",
  "checkout.phone": "Phone number",
  "checkout.payMpesa": "M-Pesa",
  "checkout.payCard": "Card",
  "checkout.payCod": "Cash on delivery",
  "checkout.payInvoice": "On invoice",
  "checkout.place": "Place order",
  "checkout.priceAuthority": "Prices are confirmed by us when the order is placed, not by your browser.",

  "trust.heading": "Who you are buying from",
  "trust.where": "Where we are",
  "trust.talk": "Talk to a person",
  "trust.delivery": "Delivery and returns",
  "trust.pay": "How you can pay",
  "trust.registered": "Registered",

  "common.from": "From",
  "common.exVat": "excluding VAT",
  "common.incVat": "including VAT",
  "common.inStock": "In stock",
  "common.outOfStock": "Out of stock",
  "common.madeToOrder": "Made to order",
  "common.language": "Language",
  "common.english": "English",
  "common.swahili": "Kiswahili",
} as const;

export type MessageKey = keyof typeof en;

const sw: Record<MessageKey, string> = {
  "nav.products": "Bidhaa",
  "nav.solutions": "Suluhisho",
  "nav.services": "Huduma",
  "nav.resources": "Miongozo",
  "nav.about": "Kuhusu sisi",
  "nav.contact": "Wasiliana nasi",
  "nav.account": "Akaunti",
  "nav.cart": "Kikapu",
  "nav.signIn": "Ingia",
  "nav.search": "Tafuta bidhaa, SKU na hati",
  "nav.skip": "Rukia hadi maudhui makuu",

  "home.title": "Kemikali za usafi za kitaalamu, pamoja na maarifa ya kuzitumia ipasavyo.",
  "home.lead":
    "Mikusanyiko, viua vijasumu, sabuni za nguo na usafi wa mikono kwa jikoni, wodi, vyoo na madobi nchini Kenya — kila bidhaa ikiwa na kipimo cha kuchanganya, muda wa kukaa na taarifa za usalama.",
  "home.browse": "Angalia bidhaa",
  "home.quote": "Omba bei",

  "zones.heading": "Utaitumia wapi?",
  "zone.RED": "Vyoo na maeneo ya usafi binafsi",
  "zone.BLUE": "Maeneo ya kawaida",
  "zone.GREEN": "Jikoni na maandalizi ya chakula",
  "zone.YELLOW": "Kliniki na maeneo ya kutengwa",

  "cart.title": "Kikapu chako",
  "cart.empty": "Kikapu chako hakina kitu.",
  "cart.subtotal": "Jumla ndogo",
  "cart.vat": "VAT",
  "cart.delivery": "Usafirishaji",
  "cart.total": "Jumla",
  "cart.checkout": "Maliza oda",
  "cart.continue": "Endelea kununua",
  "cart.remove": "Ondoa",
  "cart.quantity": "Idadi",

  "checkout.title": "Maliza oda",
  "checkout.contact": "Taarifa zako",
  "checkout.delivery": "Usafirishaji",
  "checkout.payment": "Malipo",
  "checkout.review": "Kagua",
  "checkout.name": "Jina kamili",
  "checkout.email": "Barua pepe",
  "checkout.phone": "Nambari ya simu",
  "checkout.payMpesa": "M-Pesa",
  "checkout.payCard": "Kadi",
  "checkout.payCod": "Lipa unapopokea",
  "checkout.payInvoice": "Kwa ankara",
  "checkout.place": "Tuma oda",
  "checkout.priceAuthority": "Bei huthibitishwa nasi wakati oda inatumwa, si na kivinjari chako.",

  "trust.heading": "Unanunua kutoka kwa nani",
  "trust.where": "Tulipo",
  "trust.talk": "Ongea na mtu",
  "trust.delivery": "Usafirishaji na marejesho",
  "trust.pay": "Njia za kulipa",
  "trust.registered": "Usajili",

  "common.from": "Kuanzia",
  "common.exVat": "bila VAT",
  "common.incVat": "pamoja na VAT",
  "common.inStock": "Ipo stoo",
  "common.outOfStock": "Imeisha",
  "common.madeToOrder": "Hutengenezwa ukiagiza",
  "common.language": "Lugha",
  "common.english": "English",
  "common.swahili": "Kiswahili",
};

const CATALOGUE: Record<Locale, Record<MessageKey, string>> = { en, sw };

/**
 * Returns a lookup for one locale.
 *
 * A missing key falls back to English rather than rendering the key itself. A key on a page is a bug
 * the customer should never see, and English is a worse experience than Swahili here but not a broken
 * one — `guard:i18n` fails the build when it happens, so the fallback is a safety net, not a plan.
 */
export function messages(locale: Locale): (key: MessageKey) => string {
  const table = CATALOGUE[locale];
  return (key) => table[key] ?? en[key];
}

export function localePath(locale: Locale, path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return locale === DEFAULT_LOCALE ? clean : `/${locale}${clean === "/" ? "" : clean}`;
}
