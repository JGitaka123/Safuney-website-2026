import type { Metadata } from "next";
import { config } from "@/lib/env";
import { site } from "@/config/site";
import { isIndexable } from "@/lib/seo/indexing";

export const metadata: Metadata = {
  title: {
    default: `${site.legalName} — kemikali na huduma za usafi, Kenya`,
    template: `%s — ${site.shortName}`,
  },
  description:
    "Mikusanyiko, viua vijasumu, sabuni za nguo na usafi wa mikono kwa taasisi, hoteli, viwanda na biashara nchini Kenya.",
  robots: isIndexable() ? { index: true, follow: true } : { index: false, follow: false },
  alternates: { canonical: "/sw", languages: { en: "/", sw: "/sw" } },
  openGraph: { type: "website", siteName: site.legalName, locale: "sw_KE", alternateLocale: ["en_KE"], url: `${config.siteUrl}/sw` },
};

/**
 * The Swahili tree.
 *
 * A route group rather than a duplicated site: these pages import the same server components as the
 * English ones and pass them a different message lookup, so a change to the cart is a change to one
 * cart. `lang` is set here because it is the one thing that genuinely differs at the document level,
 * and a screen reader reading Swahili with an English voice is worse than no translation at all.
 */
export default function SwahiliLayout({ children }: { children: React.ReactNode }) {
  return <div lang="sw">{children}</div>;
}
