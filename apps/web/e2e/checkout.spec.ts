import { expect, test } from "@playwright/test";
import { expectNoA11yViolations, expectNoHorizontalOverflow } from "./helpers";

const PRODUCT = "/products/disinfection/qac-surface-food-contact-sanitiser";

test.describe("checkout", () => {
  test("empty cart shows honest empty state and passes axe", async ({ page }) => {
    const res = await page.goto("/checkout");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Checkout");
    await expect(page.getByRole("heading", { level: 2, name: "Your cart is empty" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoA11yViolations(page);
  });

  test("unauthenticated access to order tracking requires token", async ({ page }) => {
    const res = await page.goto("/orders/SFN-20260909-0001");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Access token required" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoA11yViolations(page);
  });

  test("stepper contact validation and progression", async ({ page }) => {
    // Add product to cart first
    await page.goto(PRODUCT);
    await page.getByRole("radio", { name: /5 L/ }).check();
    await page.getByRole("button", { name: "Add to cart" }).click();
    await expect(page.getByText(/Added 1 × QAC-based sanitiser/)).toBeVisible();

    // Navigate to checkout
    await page.goto("/checkout");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Checkout");
    await expect(page.getByRole("heading", { name: "1. Contact details" })).toBeVisible();

    // Trigger validation on empty submit
    await page.getByRole("button", { name: "Continue to delivery" }).click();
    await expect(page.getByText("Enter the name of the person placing the order.")).toBeVisible();

    // Fill valid contact information
    await page.getByLabel("Full name").fill("Amina Mwangi");
    await page.getByLabel("Email address").fill("amina@example.test");
    await page.getByLabel("Phone number").fill("0712345678");
    await page.getByLabel("Organisation / Company (optional)").fill("Nairobi Hospital Stores");

    await expectNoHorizontalOverflow(page);
    await expectNoA11yViolations(page);

    // Proceed to Delivery step
    await page.getByRole("button", { name: "Continue to delivery" }).click();
    await expect(page.getByRole("heading", { name: "2. Delivery & collection" })).toBeVisible();

    // Choose Collection
    await page.getByLabel(/Collection \(Free\)/).check();
    await page.getByRole("button", { name: "Continue to payment" }).click();

    // Proceed to Payment step
    await expect(page.getByRole("heading", { name: "3. Payment method" })).toBeVisible();
    await page.getByLabel("Cash on delivery").check();

    // Proceed to Review step
    await page.getByRole("button", { name: "Review order" }).click();
    await expect(page.getByRole("heading", { name: "4. Review and place order" })).toBeVisible();
    await expect(page.getByText("Amina Mwangi (Nairobi Hospital Stores)")).toBeVisible();
    await expect(page.getByText("Collection from Safuney Mombasa Road")).toBeVisible();
    await expect(page.getByText("Cash / M-Pesa on delivery")).toBeVisible();
    await expect(page.getByRole("button", { name: "Place order (Cash on delivery)" })).toBeVisible();

    await expectNoHorizontalOverflow(page);
    await expectNoA11yViolations(page);
  });
});
