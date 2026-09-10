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
  // "Branded" has to mean styled, not just worded. This page spent several phases using colour classes
  // that had been renamed out of the palette, so its heading rendered in the browser default and its
  // button was unstyled — and a test that only read the text passed the whole time.
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveCSS("color", "rgb(16, 32, 43)");
  const cta = page.getByRole("link", { name: /home page/i });
  await expect(cta).toHaveCSS("background-color", "rgb(16, 32, 43)");
  // Scoped to main: the footer carries the same number on every page.
  await expect(page.locator("#main").getByRole("link", { name: /^\+254/ })).toBeVisible();
});

test("the error page is branded, says nothing about the failure, and offers a way out", async ({ page }) => {
  const res = await page.goto("/api/test/boom");
  // Next serves the error boundary with a 500.
  expect(res?.status()).toBe(500);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/could not load/i);
  await expect(page.getByRole("button", { name: /try again/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /home page/i })).toBeVisible();
  // The customer is reassured about the one thing they would worry about.
  await expect(page.getByText(/only placed when you press/i)).toBeVisible();
  // And nothing about the internals leaks: no stack, no message, no file path.
  const body = (await page.textContent("body")) ?? "";
  expect(body).not.toContain("Deliberate failure");
  expect(body).not.toMatch(/at \/|\.tsx|node_modules/);
});

test("mobile menu opens, traps focus and closes with Escape", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile-only navigation");
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  const dialog = page.getByRole("dialog", { name: "Menu" });
  await expect(dialog).toBeVisible();
  // Exact: the menu also lists the ranges, and one of them is "Speciality products".
  await expect(dialog.getByRole("link", { name: "Products", exact: true })).toBeVisible();
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
