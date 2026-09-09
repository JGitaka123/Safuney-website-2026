/** Business constants shared by every package. Business *rules* (fees, terms) live in the database. */
export const CURRENCY = "KES" as const;
/** Kenyan standard VAT rate in basis points. Per-variant rates live on ProductVariant.vatRateBps. */
export const DEFAULT_VAT_RATE_BPS = 1600;
/** Kenyan mobile numbers: +254 7XX XXX XXX or +254 1XX XXX XXX */
export const KENYAN_MOBILE_E164 = /^\+254(7\d{8}|1\d{8})$/;
export const ORDER_NUMBER_PREFIX = "SFN";
export const QUOTE_NUMBER_PREFIX = "SFQ";
export const INVOICE_NUMBER_PREFIX = "SFI";

export const KENYAN_COUNTIES = [
  "Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo-Marakwet", "Embu", "Garissa", "Homa Bay", "Isiolo",
  "Kajiado", "Kakamega", "Kericho", "Kiambu", "Kilifi", "Kirinyaga", "Kisii", "Kisumu", "Kitui", "Kwale",
  "Laikipia", "Lamu", "Machakos", "Makueni", "Mandera", "Marsabit", "Meru", "Migori", "Mombasa", "Murang'a",
  "Nairobi", "Nakuru", "Nandi", "Narok", "Nyamira", "Nyandarua", "Nyeri", "Samburu", "Siaya", "Taita-Taveta",
  "Tana River", "Tharaka-Nithi", "Trans Nzoia", "Turkana", "Uasin Gishu", "Vihiga", "Wajir", "West Pokot",
] as const;
export type KenyanCounty = (typeof KENYAN_COUNTIES)[number];

/** Normalise a Kenyan phone number to E.164. Returns null when it is not a valid Kenyan mobile. */
export function normaliseKenyanMobile(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, "");
  let candidate: string;
  if (digits.startsWith("+254")) candidate = digits;
  else if (digits.startsWith("254")) candidate = `+${digits}`;
  else if (digits.startsWith("0") && digits.length === 10) candidate = `+254${digits.slice(1)}`;
  else if (/^[17]\d{8}$/.test(digits)) candidate = `+254${digits}`;
  else return null;
  return KENYAN_MOBILE_E164.test(candidate) ? candidate : null;
}
