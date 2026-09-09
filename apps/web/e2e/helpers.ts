import { expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/** No horizontal scroll at any viewport (plan §9). */
export async function expectNoHorizontalOverflow(page: Page) {
  const { scrollW, innerW } = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    innerW: window.innerWidth,
  }));
  expect(scrollW, "page must not scroll horizontally").toBeLessThanOrEqual(innerW);
}

/** WCAG 2.1 AA via axe-core (non-negotiable #8). */
export async function expectNoA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}
