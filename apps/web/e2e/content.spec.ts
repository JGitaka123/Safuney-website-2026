import { expect, test } from "@playwright/test";
import { expectNoA11yViolations, expectNoHorizontalOverflow } from "./helpers";

const PAGES = ["/solutions", "/solutions/hospitality", "/solutions/healthcare", "/resources", "/resources/colour-coding", "/resources/dilution", "/resources/safety-data-sheets"];

test.describe("content and SEO", () => {
  for (const path of PAGES) {
    test(`${path} renders, fits the viewport and passes axe`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await expectNoA11yViolations(page);
    });
  }

  test("an industry page carries FAQ and breadcrumb structured data", async ({ page }) => {
    await page.goto("/solutions/foodservice");
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    const types = blocks.flatMap((b) => {
      const parsed: unknown = JSON.parse(b);
      return (Array.isArray(parsed) ? parsed : [parsed]).map((d) => (d as { "@type": string })["@type"]);
    });
    expect(types).toContain("FAQPage");
    expect(types).toContain("BreadcrumbList");
    // The questions on the page are the questions in the structured data, not a separate set.
    const faq = blocks.map((b) => JSON.parse(b) as unknown).flatMap((d) => (Array.isArray(d) ? d : [d])).find((d) => (d as { "@type": string })["@type"] === "FAQPage") as { mainEntity: Array<{ name: string }> };
    await expect(page.getByText(faq.mainEntity[0]!.name)).toBeVisible();
  });

  test("the interim site is still not indexable, and the sitemap gives nothing away", async ({ page }) => {
    const robots = await page.goto("/robots.txt");
    expect(await robots?.text()).toContain("Disallow: /");
    const sitemap = await page.goto("/sitemap.xml");
    const xml = (await sitemap?.text()) ?? "";
    expect(xml).toContain("<urlset");
    expect(xml).not.toContain("<loc>");
  });

  test("a product's share card is generated from the product itself", async ({ page, request }) => {
    await page.goto("/products/disinfection/qac-surface-food-contact-sanitiser");
    const og = await page.locator('meta[property="og:image"]').first().getAttribute("content");
    expect(og).toBeTruthy();
    const image = await request.get(og!);
    expect(image.status()).toBe(200);
    expect(image.headers()["content-type"]).toContain("image/png");
    // A 1200x630 PNG of a real card, not an empty or error response.
    expect((await image.body()).byteLength).toBeGreaterThan(10_000);
  });

  test("the Swahili home page is Swahili, marked as such, and links back", async ({ page }) => {
    const response = await page.goto("/sw");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Kemikali za usafi");
    // The document region is marked Swahili, so a screen reader does not read it with an English voice.
    await expect(page.locator('[lang="sw"]')).toBeVisible();
    await expect(page.getByRole("heading", { name: "Utaitumia wapi?" })).toBeVisible();
    // hreflang points both ways, which is what makes the alternate real rather than decorative.
    await expect(page.locator('link[hreflang="en"]')).toHaveCount(1);
    await expectNoHorizontalOverflow(page);
    await expectNoA11yViolations(page);
  });

  test("the language switcher moves between the two and marks where you are", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Language" });
    await expect(nav.getByRole("link", { name: "English" })).toHaveAttribute("aria-current", "page");
    await nav.getByRole("link", { name: "Kiswahili" }).click();
    await expect(page).toHaveURL(/\/sw$/);
    const swNav = page.getByRole("navigation", { name: "Language" });
    await expect(swNav.getByRole("link", { name: "Kiswahili" })).toHaveAttribute("aria-current", "page");
    await swNav.getByRole("link", { name: "English" }).click();
    await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/);
  });

  test("the home page says who you are buying from", async ({ page }) => {
    await page.goto("/");
    const trust = page.getByRole("region", { name: "Who you are buying from" });
    await expect(trust).toBeVisible();
    await expect(trust.getByText(/Mombasa Road/)).toBeVisible();
    await expect(trust.getByRole("link", { name: "WhatsApp" })).toBeVisible();
    await expect(trust.getByText(/M-Pesa, card, cash on delivery/)).toBeVisible();
  });
});
