import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * The design system page renders every primitive in every state (plan §11.4). It must fit a 360 px
 * screen without horizontal scroll (plan §9) and pass axe at WCAG 2.1 AA at both breakpoints.
 */
const viewports = [
  { name: "mobile", width: 360, height: 780 },
  { name: "desktop", width: 1280, height: 900 },
] as const;

for (const vp of viewports) {
  test.describe(`/design at ${vp.width}px (${vp.name})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("does not overflow horizontally", async ({ page }) => {
      await page.goto("/design");
      await expect(page.getByRole("heading", { level: 1, name: "Design system" })).toBeVisible();
      const widths = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(widths.scrollWidth).toBe(widths.innerWidth);
    });

    test("has no axe violations at WCAG 2.1 AA", async ({ page }) => {
      await page.goto("/design");
      await expect(page.getByRole("heading", { level: 1, name: "Design system" })).toBeVisible();
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(results.violations).toEqual([]);
    });
  });
}
