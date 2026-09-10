import type { MetadataRoute } from "next";
import { db } from "@safuney/db";
import { config, services } from "@/lib/env";
import { isIndexable } from "@/lib/seo/indexing";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

/** Pages that exist regardless of what is in the database. */
const STATIC: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }> = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/products", priority: 0.9, changeFrequency: "weekly" },
  { path: "/services", priority: 0.7, changeFrequency: "monthly" },
  { path: "/solutions", priority: 0.8, changeFrequency: "monthly" },
  { path: "/resources", priority: 0.7, changeFrequency: "monthly" },
  { path: "/about", priority: 0.5, changeFrequency: "yearly" },
  { path: "/contact", priority: 0.6, changeFrequency: "yearly" },
  { path: "/delivery-and-returns", priority: 0.4, changeFrequency: "yearly" },
  { path: "/quote", priority: 0.6, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.2, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.2, changeFrequency: "yearly" },
];

/**
 * The sitemap of a site that blocks crawlers is a leak, not an aid: it hands a complete inventory of
 * an unfinished catalogue to anyone who asks. So it is empty until the site is actually indexable.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!isIndexable()) return [];
  const base = config.siteUrl;
  const entries: MetadataRoute.Sitemap = STATIC.map((s) => ({
    url: `${base}${s.path === "/" ? "" : s.path}`,
    priority: s.priority,
    changeFrequency: s.changeFrequency,
    // Only the home page has a Swahili edition (app/sw/page.tsx); an alternate for any other path is a 404.
    ...(s.path === "/" ? { alternates: { languages: { en: base, sw: `${base}/sw` } } } : {}),
  }));
  if (!services.database()) return entries;

  const [categories, products, pages] = await Promise.all([
    db().category.findMany({ where: { isActive: true }, select: { slug: true, updatedAt: true } }),
    // Only what a customer can actually see: an unreviewed product in the sitemap is a 404 to Google.
    db().product.findMany({ where: { isActive: true, needsPoReview: false }, select: { slug: true, updatedAt: true, category: { select: { slug: true } } } }),
    db().contentPage.findMany({ where: { isPublished: true, locale: "en" }, select: { slug: true, updatedAt: true } }),
  ]);

  for (const c of categories) {
    entries.push({ url: `${base}/products/${c.slug}`, lastModified: c.updatedAt, changeFrequency: "weekly", priority: 0.8 });
  }
  for (const p of products) {
    entries.push({ url: `${base}/products/${p.category.slug}/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly", priority: 0.7 });
  }
  for (const page of pages) {
    entries.push({ url: `${base}/${page.slug}`, lastModified: page.updatedAt, changeFrequency: "monthly", priority: 0.4 });
  }
  return entries;
}
