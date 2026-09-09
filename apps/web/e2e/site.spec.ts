import { expect, test } from "@playwright/test";
import { expectNoA11yViolations, expectNoHorizontalOverflow } from "./helpers";

const pages = ["/", "/products", "/services", "/about", "/contact", "/privacy", "/terms", "/delivery-and-returns"];

for (const path of pages) {
  test(`${path} renders, fits the viewport and passes axe`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status(), `${path} should return 200`).toBe(200);
    await expect(page.locator("h1")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoA11yViolations(page);
  });
}

test("the interim site is not indexable", async ({ page, request }) => {
  const res = await page.goto("/");
  expect(res?.headers()["x-robots-tag"]).toContain("noindex");
  const robots = await request.get("/robots.txt");
  expect(await robots.text()).toMatch(/Disallow: \//);
});

test("404 page is branded and returns 404", async ({ page }) => {
  const res = await page.goto("/this-page-does-not-exist");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/does not exist/i);
  await expect(page.getByRole("link", { name: /home page/i })).toBeVisible();
});

test("mobile menu opens, traps focus and closes with Escape", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile-only navigation");
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  const dialog = page.getByRole("dialog", { name: "Menu" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Products" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Open menu" })).toBeFocused();
});

test("keyboard users can reach the skip link and main content", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
});

test("zone filter on /products is URL-synced", async ({ page }) => {
  await page.goto("/products?zone=kitchen");
  await expect(page.getByText(/Showing categories for/)).toContainText("Kitchen and food prep");
  await page.getByRole("link", { name: "Show all categories" }).click();
  await expect(page).toHaveURL(/\/products$/);
});
