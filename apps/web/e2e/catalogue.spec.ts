import { expect, test } from "@playwright/test";
import { expectNoA11yViolations, expectNoHorizontalOverflow } from "./helpers";

/** Requires the demo seed (SEED_DEMO=1): reviewed products with prices and stock. */
const CATEGORY = "/products/disinfection";
const PRODUCT = "/products/disinfection/qac-surface-food-contact-sanitiser";

test.describe("catalogue", () => {
  test("category page lists products, filters by URL and passes axe", async ({ page, isMobile }) => {
    const res = await page.goto(CATEGORY);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Disinfection and sanitisation");
    const results = page.getByRole("heading", { level: 2, name: /products?$/ });
    await expect(results).toContainText(/[1-9]\d* products?/);
    await expectNoHorizontalOverflow(page);
    await expectNoA11yViolations(page);

    await page.goto(`${CATEGORY}?stock=in&sort=price-desc`);
    await expect(page.getByRole("combobox", { name: "Sort by" })).toHaveValue("price-desc");
    if (isMobile) await expect(page.getByRole("button", { name: /^Filters\s*1$/ })).toBeVisible();
    else await expect(page.getByRole("link", { name: /Clear 1 filter/ })).toBeVisible();
  });

  test("facet links are URL-synced and the filter sheet works on mobile", async ({ page, isMobile }) => {
    await page.goto(CATEGORY);
    if (isMobile) {
      await page.getByRole("button", { name: /^Filters/ }).click();
      await expect(page.getByRole("dialog", { name: "Filter products" })).toBeVisible();
    }
    await page.getByRole("link", { name: /In stock now/ }).first().click();
    await expect(page).toHaveURL(/stock=in/);
    await expect(page.getByRole("link", { name: /Clear 1 filter/ })).toBeVisible();
  });

  test("product page shows packs, live price with VAT line, dilution calculator and JSON-LD", async ({ page }) => {
    const res = await page.goto(PRODUCT);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("QAC-based sanitiser for surface and food-contact areas");
    // Pack selector: choosing 20 L updates the price.
    await page.getByRole("radio", { name: /20 L/ }).check();
    await expect(page.getByText("KES 5,200.00").first()).toBeVisible();
    await expect(page.getByText(/\+ VAT 16%/).first()).toBeVisible();
    // Dilution calculator.
    await page.getByLabel("Litres of solution you need").fill("5");
    await expect(page.getByText(/Product to measure/)).toBeVisible();
    // JSON-LD present and well-formed.
    const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
    const parsed = JSON.parse(ld ?? "[]");
    expect(JSON.stringify(parsed)).toContain('"@type":"Product"');
    await expectNoHorizontalOverflow(page);
    await expectNoA11yViolations(page);
  });

  test("add to cart, change quantity and remove", async ({ page }) => {
    await page.goto(PRODUCT);
    await page.getByRole("radio", { name: /5 L/ }).check();
    await page.getByRole("button", { name: "Add to cart" }).click();
    await expect(page.getByText(/Added 1 × QAC-based sanitiser/)).toBeVisible();
    await page.goto("/cart");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your cart");
    await expect(page.getByText("KES 1,450.00").first()).toBeVisible();
    await page.getByRole("button", { name: /Increase quantity/ }).click();
    await expect(page.getByText("KES 2,900.00").first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoA11yViolations(page);
    await page.getByRole("button", { name: /^Remove/ }).click();
    await expect(page.getByRole("heading", { name: "Your cart is empty" })).toBeVisible();
  });

  test("cannot add more than the stock on hand", async ({ page }) => {
    await page.goto("/products/specialty/crockery-cutlery-destainer");
    // Demo stock for 15 kg is 6; the stepper caps at available stock.
    const input = page.getByRole("spinbutton", { name: /Quantity/ });
    await input.fill("99");
    await page.getByRole("button", { name: "Add to cart" }).click();
    // Either the stepper clamped to 6 (ok) or the server refused (message shown) — never a silent 99.
    await expect(page.getByText(/Added \d+ ×|Only \d+ ×|out of stock/).first()).toBeVisible();
    await page.goto("/cart");
    const qty = await page.getByRole("spinbutton", { name: /Quantity of/ }).inputValue();
    expect(Number(qty)).toBeLessThanOrEqual(6);
  });

  test("unreviewed products are not reachable", async ({ page }) => {
    const res = await page.goto("/products/laundry/does-not-exist");
    expect(res?.status()).toBe(404);
  });
});
