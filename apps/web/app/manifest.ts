import type { MetadataRoute } from "next";
import { site } from "@/config/site";

/**
 * The installable app. Kenyan buyers order from a phone on a patchy connection; an installed shortcut
 * that opens instantly and browses the catalogue offline is worth more here than on a desk.
 *
 * The manifest is served whatever the flag says — it is inert without the service worker, and gating
 * it would mean an installed app losing its identity the moment the flag toggled.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${site.legalName} — cleaning and hygiene`,
    short_name: site.shortName,
    description: site.tagline,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f7f9",
    theme_color: "#10202b",
    lang: "en-KE",
    categories: ["business", "shopping"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Order sheet", url: "/order-sheet" },
      { name: "Your orders", url: "/account/orders" },
    ],
  };
}
