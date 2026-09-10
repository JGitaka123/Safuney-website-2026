/**
 * Storefront button styles (ADR 0017), as class strings so they work on Link, <a> and <button> alike.
 *
 * - `cta`: the brand green, ink text. The main action on a page (the role Alliance Chemical gives
 *   its yellow button): Shop products, Get a price.
 * - `brand`: the brand blue, white text (7.69:1). The header's Request Quote and the filled secondary.
 * - `outline`: blue outline on white, for the second action beside a filled one.
 * - `whatsapp`: WhatsApp's green, ink text. Only on click-to-chat links.
 * - `primary` / `secondary`: ink and neutral outline, for everything else on light ground.
 * - `ghost`: outline on the dark hero and footer.
 * - `sm`: the compact size the header's button row uses.
 */
const base =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-button px-6 text-button font-medium whitespace-nowrap " +
  "transition-colors duration-150 motion-reduce:transition-none";

export const btn = {
  cta: `${base} bg-cta text-ink hover:bg-cta-hover`,
  brand: `${base} bg-accent text-white hover:bg-accent-deep`,
  outline: `${base} border-2 border-accent bg-surface text-accent hover:bg-accent-wash`,
  whatsapp: `${base} bg-whatsapp text-ink hover:bg-[#3ee07a]`,
  primary: `${base} bg-ink text-white hover:bg-accent-deep`,
  secondary: `${base} border border-stainless bg-surface text-ink hover:border-ink hover:bg-ground`,
  ghost: `${base} border-2 border-white/40 text-white hover:border-white hover:bg-white/10`,
  sm: "min-h-10 px-4 text-small",
} as const;
