/**
 * Storefront button styles (ADR 0017), as class strings so they work on Link, <a> and <button> alike.
 *
 * - `cta`: the brand green, ink text. Only for the action we most want taken: get a price.
 * - `whatsapp`: WhatsApp's green, ink text. Only on click-to-chat links.
 * - `primary` / `secondary`: ink and outline, for everything else on light ground.
 * - `ghost`: outline on the dark hero and footer.
 */
const base =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-button px-6 text-button font-medium whitespace-nowrap " +
  "transition-colors duration-150 motion-reduce:transition-none";

export const btn = {
  cta: `${base} bg-cta text-ink hover:bg-cta-hover`,
  whatsapp: `${base} bg-whatsapp text-ink hover:bg-[#3ee07a]`,
  primary: `${base} bg-ink text-white hover:bg-accent-deep`,
  secondary: `${base} border border-stainless bg-surface text-ink hover:border-ink hover:bg-ground`,
  ghost: `${base} border border-white/35 text-white hover:border-white hover:bg-white/10`,
} as const;
