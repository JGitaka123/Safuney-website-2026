import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { db } from "@safuney/db";
import { services } from "@/lib/env";
import { site } from "@/config/site";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Share card showing the product name, its cleaning zone and the pack sizes Safuney supplies it in.";

/** The colour-coded zones, as hex — Satori has no Tailwind, so the palette is repeated here. */
const ZONE: Record<string, { fill: string; label: string }> = {
  RED: { fill: "#b8132a", label: "Washrooms" },
  BLUE: { fill: "#1747c2", label: "General areas" },
  GREEN: { fill: "#137035", label: "Kitchen and food prep" },
  YELLOW: { fill: "#f2c200", label: "Clinical and isolation" },
};

/**
 * The share card for a product.
 *
 * Generated rather than uploaded: there are no product photographs yet, and a shared link with no
 * image is a link nobody clicks. It is drawn from what the product actually is — its name, its packs
 * and its cleaning zone — in the site's own palette and typeface, so a link pasted into WhatsApp
 * still looks like Safuney rather than like a bare URL.
 */
export default async function Image({ params }: { params: Promise<{ category: string; product: string }> }) {
  const { category, product: slug } = await params;
  // Read from `public/`, not from beside this file: the bundler rewrites `import.meta.url` into the
  // build output, where a colocated asset no longer sits next to the chunk.
  const [semibold, regular] = await Promise.all([
    readFile(join(process.cwd(), "public/fonts/plex-sans-600-og.woff")),
    readFile(join(process.cwd(), "public/fonts/plex-sans-400-og.woff")),
  ]);
  const fonts = [
    { name: "Plex", data: semibold, weight: 600 as const, style: "normal" as const },
    { name: "Plex", data: regular, weight: 400 as const, style: "normal" as const },
  ];

  const product = services.database()
    ? await db().product.findFirst({
        where: { slug, isActive: true, needsPoReview: false, category: { slug: category } },
        select: { name: true, shortDescription: true, zone: true, hazardClass: true, variants: { where: { isActive: true }, select: { packLabel: true }, orderBy: { sortOrder: "asc" }, take: 5 } },
      })
    : null;

  const zone = product ? ZONE[product.zone] : undefined;
  const packs = product?.variants.map((v) => v.packLabel) ?? [];

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", backgroundColor: "#ffffff", fontFamily: "Plex" }}>
        {/* The zone band is the site's own signature: colour always carries its word with it. */}
        <div style={{ height: 14, width: "100%", backgroundColor: zone?.fill ?? "#0b5e73", display: "flex" }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "56px 64px" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontSize: 30, fontWeight: 600, color: "#0b5e73", letterSpacing: "-0.01em" }}>Safuney</span>
              {zone ? (
                <span style={{ fontSize: 22, color: "#4a5c68" }}>
                  {"·"} {zone.label}
                </span>
              ) : null}
            </div>
            <div style={{ display: "flex", marginTop: 36, fontSize: product && product.name.length > 44 ? 58 : 72, fontWeight: 600, color: "#10202b", lineHeight: 1.1, letterSpacing: "-0.015em" }}>
              {product?.name ?? "Cleaning and hygiene products"}
            </div>
            {product?.shortDescription ? (
              <div style={{ display: "flex", marginTop: 24, fontSize: 28, color: "#4a5c68", lineHeight: 1.35 }}>
                {product.shortDescription.length > 130 ? `${product.shortDescription.slice(0, 127)}…` : product.shortDescription}
              </div>
            ) : null}
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 12 }}>
              {packs.map((p) => (
                <div key={p} style={{ display: "flex", border: "1px solid #cbd5db", padding: "8px 18px", fontSize: 24, color: "#10202b" }}>
                  {p}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", fontSize: 22, color: "#4a5c68" }}>{site.legalName} · Nairobi, Kenya</div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
