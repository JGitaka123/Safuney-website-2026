import { expect, test } from "@playwright/test";
import { expectNoA11yViolations, expectNoHorizontalOverflow } from "./helpers";

/** Requires the demo seed (SEED_DEMO=1) and the shop.enabled flag on. */
const QAC_5L = "Quantity of QAC-based sanitiser for surface and food-contact areas 5 L";

test.describe("order sheet", () => {
  test("lists every pack size in tables and fits a 360 px screen", async ({ page }) => {
    const res = await page.goto("/order-sheet");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Order sheet");
    await expect(page.getByRole("table").first()).toBeVisible();
    expect(await page.getByRole("row").count()).toBeGreaterThan(5);
    await expect(page.getByRole("spinbutton", { name: QAC_5L })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoA11yViolations(page);
  });

  test("filters rows by name or SKU", async ({ page }) => {
    await page.goto("/order-sheet");
    const filter = page.getByLabel("Find a product or SKU on this sheet");
    await filter.fill("oven");
    await expect(page.getByRole("link", { name: "Oven / grill / hood cleaner" }).first()).toBeVisible();
    await expect(page.getByRole("spinbutton", { name: QAC_5L })).toBeHidden();
    await filter.fill("zzqxv");
    await expect(page.getByText(/No products on this sheet match/)).toBeVisible();
    await page.getByRole("button", { name: "Clear the search" }).click();
    await expect(page.getByRole("spinbutton", { name: QAC_5L })).toBeVisible();
  });

  test("adds the lines with a quantity to the cart", async ({ page }) => {
    await page.goto("/order-sheet");
    const qty = page.getByRole("spinbutton", { name: QAC_5L });
    await qty.fill("2");
    const add = page.getByRole("button", { name: "Add 1 line to cart" });
    await expect(add).toBeVisible();
    await add.click();
    const status = page.getByRole("status").filter({ hasText: "Added to cart" });
    await expect(status).toBeVisible();
    await expect(status).toContainText("2 × QAC-based sanitiser for surface and food-contact areas 5 L");
    await expect(qty).toHaveValue("");
    await page.getByRole("link", { name: /View cart/ }).click();
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByRole("spinbutton", { name: QAC_5L })).toHaveValue("2");
    // Leave the cart as it was found.
    await page.getByRole("button", { name: /^Remove QAC-based sanitiser/ }).click();
    await expect(page.getByRole("heading", { name: "Your cart is empty" })).toBeVisible();
  });

  test("pressing add with no quantities explains what is missing", async ({ page }) => {
    await page.goto("/order-sheet");
    await page.getByRole("button", { name: "Add lines to cart" }).click();
    const alert = page.getByRole("alert").filter({ hasText: "Not added" });
    await expect(alert).toContainText("Enter a quantity next to at least one product");
    await expect(alert).toBeFocused();
  });

  test("a line the server refuses is explained on its own row", async ({ page }) => {
    await page.goto("/order-sheet");
    // Demo stock for the destainer 15 kg is 6, so 50 cannot be added; the 5 L sanitiser can.
    const destainer = page.getByRole("spinbutton", { name: /Quantity of Destainer for crockery and cutlery/ }).first();
    await destainer.fill("50");
    await page.getByRole("spinbutton", { name: QAC_5L }).fill("1");
    await page.getByRole("button", { name: "Add 2 lines to cart" }).click();
    await expect(destainer).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("alert").filter({ hasText: "Not added" })).toContainText("not added");
    await expect(destainer).toHaveValue("50");
    await page.goto("/cart");
    await page.getByRole("button", { name: /^Remove QAC-based sanitiser/ }).click();
    await expect(page.getByRole("heading", { name: "Your cart is empty" })).toBeVisible();
  });
});
