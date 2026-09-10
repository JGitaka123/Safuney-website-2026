import type { IconName } from "./icons";

/** One icon per solutions page (lib/content/solutions.ts), shared by the home page and /solutions. */
export const INDUSTRY_ICON: Record<string, IconName> = {
  hospitality: "bed",
  healthcare: "hospital",
  foodservice: "utensils",
  education: "graduation",
  industrial: "factory",
  "food-and-beverage-processing": "flask",
  "facilities-management": "building",
};
