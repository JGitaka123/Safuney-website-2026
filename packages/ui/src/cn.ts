import { clsx, type ClassValue } from "clsx";

/** Class-name joiner. Tailwind v4 utilities rarely conflict in our primitives, so clsx alone is enough. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
