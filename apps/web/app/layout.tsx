import type { Metadata, Viewport } from "next";
import "./globals.css";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: {
    default: `${site.legalName} — professional cleaning and hygiene solutions, Kenya`,
    template: `%s — ${site.shortName}`,
  },
  description: site.tagline,
  // Interim site must not be indexed until domain cut-over (Phase 9).
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b5e73",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-KE">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
