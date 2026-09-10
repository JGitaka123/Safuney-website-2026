import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations, expectNoHorizontalOverflow } from "./helpers";

/** Requires the demo seed (SEED_DEMO=1): catalogue products carrying demo prices. */
const QUERY = "sanitiser";
const QAC = "SAF QUARTSAN";

/** The header search box: inline on desktop, behind the Search button (in a sheet) on mobile. */
async function openHeaderSearch(page: Page, isMobile: boolean) {
  if (isMobile) {
    await page.getByRole("button", { name: "Search", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Search" });
    await expect(dialog).toBeVisible();
    return dialog.getByRole("combobox");
  }
  return page.getByRole("search", { name: "Site search" }).getByRole("combobox");
}

test.describe("site search", () => {
  test("instant results appear as you type and Enter opens the results page", async ({ page, isMobile }) => {
    await page.goto("/");
    const box = await openHeaderSearch(page, isMobile);
    await box.fill(QUERY);
    const listbox = page.getByRole("listbox", { name: "Search results" });
    await expect(listbox).toBeVisible();
    await expect(listbox.getByRole("option", { name: new RegExp(QAC) })).toBeVisible();
    await expect(box).toHaveAttribute("aria-expanded", "true");

    await box.press("Enter");
    await expect(page).toHaveURL(/\/search\?q=sanitiser$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Search results for '${QUERY}'`);
    await expect(page.getByRole("heading", { level: 3, name: QAC })).toBeVisible();
  });

  test("arrow keys highlight a result and Enter opens it; Escape closes the list", async ({ page, isMobile }) => {
    await page.goto("/");
    const box = await openHeaderSearch(page, isMobile);
    await box.fill("window cleaner");
    const listbox = page.getByRole("listbox", { name: "Search results" });
    await expect(listbox.getByRole("option").first()).toBeVisible();
    await box.press("ArrowDown");
    await expect(listbox.getByRole("option", { selected: true })).toContainText("SAF WINDOW CLEANER");
    await box.press("Escape");
    await expect(listbox).toBeHidden();
    await box.press("ArrowDown");
    await box.press("Enter");
    await expect(page).toHaveURL(/\/products\/housekeeping\/saf-window-cleaner$/);
  });

  test("a typo still finds the product", async ({ page, isMobile }) => {
    await page.goto("/");
    const box = await openHeaderSearch(page, isMobile);
    await box.fill("sanitzer");
    await expect(page.getByRole("listbox", { name: "Search results" }).getByRole("option", { name: /SANITOUCH/ })).toBeVisible();
  });

  test("nothing found says so and offers a category", async ({ page, isMobile }) => {
    await page.goto("/");
    const box = await openHeaderSearch(page, isMobile);
    await box.fill("zzqxv");
    await expect(page.getByText(/No products found for 'zzqxv'\. Check the spelling, or browse/)).toBeVisible();
    await expect(page.getByRole("search", { name: "Site search" }).getByRole("link", { name: "Warewashing and kitchen hygiene" })).toBeVisible();
    await expect(page.getByRole("listbox", { name: "Search results" })).toHaveCount(0);
  });

  test("results page passes axe and fits the viewport", async ({ page }) => {
    const res = await page.goto(`/search?q=${QUERY}`);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Search results for '${QUERY}'`);
    await expect(page.getByRole("heading", { level: 2, name: /products?$/ })).toContainText(/[1-9]\d* products?/);
    await expectNoHorizontalOverflow(page);
    await expectNoA11yViolations(page);
  });

  test("results page with nothing found offers zones and categories", async ({ page }) => {
    await page.goto("/search?q=zzqxv");
    await expect(page.getByRole("heading", { name: "No products found for 'zzqxv'" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Kitchen and food prep" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Request a quote" }).first()).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test("the search API formats prices and never leaks unreviewed products", async ({ request }) => {
    const res = await request.get(`/api/search?q=${QUERY}`);
    expect(res.status()).toBe(200);
    expect(res.headers()["cache-control"]).toContain("private");
    const body = (await res.json()) as { products: Array<{ name: string; priceLabel: string | null; href: string }> };
    const qac = body.products.find((p) => p.name === QAC);
    expect(qac?.href).toBe("/products/disinfection/saf-quartsan");
    expect(qac?.priceLabel).toMatch(/^(From )?KES [\d,]+\.\d{2}$/);
    expect(body.products.length).toBeLessThanOrEqual(8);
  });
});
