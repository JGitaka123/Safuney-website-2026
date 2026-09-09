import type { HazardClass, ZoneKey } from "@safuney/ui";

/** Shape of GET /api/search?q= responses. Everything is display-ready; prices are strings. */
export interface SearchApiProduct {
  id: string;
  name: string;
  href: string;
  categoryName: string;
  packs: string[];
  /** Preformatted, e.g. "From KES 1,250.00"; null when the product is quote-only. */
  priceLabel: string | null;
  zone: ZoneKey | null;
  hazard: HazardClass;
  hazardLabel: string | null;
}

export interface SearchApiCategory {
  id: string;
  name: string;
  href: string;
  productCount: number;
}

export interface SearchApiDocument {
  id: string;
  title: string;
  typeLabel: string;
  href: string;
}

export interface SearchApiResponse {
  q: string;
  products: SearchApiProduct[];
  categories: SearchApiCategory[];
  documents: SearchApiDocument[];
}
