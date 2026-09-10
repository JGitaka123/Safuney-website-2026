import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations, expectNoHorizontalOverflow } from "./helpers";

const PRODUCT = "/products/disinfection/saf-quartsan";

/** Runs against PAYMENTS_MODE=mock (CI and previews): the test controls stand in for the provider callback. */
async function addToCart(page: Page) {
  await page.goto(PRODUCT);
  await page.getByRole("radio", { name: /5 L/ }).check();
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByText(/Added 1 × SAF QUARTSAN/)).toBeVisible();
}

async function fillContact(page: Page) {
  await expect(page.getByRole("heading", { name: "1. Contact details" })).toBeVisible();
  await page.getByLabel("Full name").fill("Amina Mwangi");
  await page.getByLabel("Email address").fill("amina@example.test");
  await page.getByLabel("Phone number").fill("0712345678");
  await page.getByLabel("Organisation / Company (optional)").fill("Nairobi Hospital Stores");
  await page.getByRole("button", { name: "Continue to delivery" }).click();
  await expect(page.getByRole("heading", { name: "2. Delivery & collection" })).toBeVisible();
}

async function chooseCollection(page: Page) {
  await page.getByLabel(/Collection \(Free\)/).check();
  await page.getByRole("button", { name: "Continue to payment" }).click();
  await expect(page.getByRole("heading", { name: "3. Payment method" })).toBeVisible();
}

async function startCheckout(page: Page) {
  await addToCart(page);
  await page.goto("/checkout");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Checkout");
  await fillContact(page);
}

function orderNumberFromUrl(page: Page): string {
  const match = /\/orders\/(SFN-\d{8}-\d{4})/.exec(page.url());
  expect(match, `expected an order tracking URL, got ${page.url()}`).not.toBeNull();
  return match![1]!;
}

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

  test("contact validation, delivery quote in the total, and review", async ({ page }) => {
    await addToCart(page);
    await page.goto("/checkout");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Checkout");
    await expect(page.getByRole("heading", { name: "1. Contact details" })).toBeVisible();

    // Empty submit: field errors, and a summary alert that is not the Next.js route announcer.
    await page.getByRole("button", { name: "Continue to delivery" }).click();
    await expect(page.getByText("Enter the name of the person placing the order.")).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "Check the highlighted contact fields." })).toBeVisible();
    await page.getByLabel("Phone number").fill("12345");
    await page.getByRole("button", { name: "Continue to delivery" }).click();
    await expect(page.getByText(/does not look like a Kenyan mobile number/)).toBeVisible();

    await expectNoHorizontalOverflow(page);
    await expectNoA11yViolations(page);

    await fillContact(page);

    // Delivery to Nairobi is quoted by the server and the fee is shown in the summary total.
    await page.getByLabel("County", { exact: true }).selectOption("Nairobi");
    await expect(page.getByText("Quoted on county selection")).toHaveCount(0);
    await expect(page.getByText("Calculating…")).toHaveCount(0);
    await page.getByLabel("Town, Estate or Sub-county").fill("Westlands");
    await page.getByRole("button", { name: "Continue to payment" }).click();
    await expect(page.getByRole("heading", { name: "3. Payment method" })).toBeVisible();
    await expect(page.getByRole("radio", { name: /^M-Pesa/ })).toBeChecked();

    await page.getByLabel("Cash on delivery").check();
    await page.getByRole("button", { name: "Review order" }).click();
    await expect(page.getByRole("heading", { name: "4. Review and place order" })).toBeVisible();
    await expect(page.getByText("Amina Mwangi (Nairobi Hospital Stores)")).toBeVisible();
    await expect(page.getByText(/Westlands, Nairobi/)).toBeVisible();
    await expect(page.getByText("Cash or M-Pesa on delivery")).toBeVisible();
    await expect(page.getByRole("button", { name: "Place order (Cash on delivery)" })).toBeVisible();

    await expectNoHorizontalOverflow(page);
    await expectNoA11yViolations(page);
  });

  test("cash on delivery: places the order and lands on the tracking page", async ({ page }) => {
    await startCheckout(page);
    await chooseCollection(page);
    await page.getByLabel("Cash on delivery").check();
    await page.getByRole("button", { name: "Review order" }).click();
    await page.getByRole("button", { name: "Place order (Cash on delivery)" }).click();

    await page.waitForURL(/\/orders\/SFN-\d{8}-\d{4}\?token=/);
    const number = orderNumberFromUrl(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(number);
    await expect(page.getByText("Order confirmed", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Order confirmed. Pay the rider when it arrives.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Pay another way" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Test controls" })).toHaveCount(0);

    // The cart is consumed by the order.
    await page.goto("/cart");
    await expect(page.getByRole("heading", { level: 2, name: /empty/i })).toBeVisible();

    await page.goto(`/orders/${number}?token=${new URL(page.url()).searchParams.get("token") ?? ""}`);
    await expectNoHorizontalOverflow(page);
    await expectNoA11yViolations(page);
  });

  test("M-Pesa: prompt, simulated success, then the paid tracking page", async ({ page }) => {
    await startCheckout(page);
    await chooseCollection(page);
    await expect(page.getByRole("radio", { name: /^M-Pesa/ })).toBeChecked();
    await expect(page.getByLabel("Phone number for M-Pesa request")).toHaveValue("0712345678");
    await page.getByRole("button", { name: "Review order" }).click();
    await page.getByRole("button", { name: /^Pay KES [\d,.]+ with M-Pesa$/ }).click();

    await expect(page.getByRole("heading", { name: "Check your phone" })).toBeVisible();
    await expect(page.getByText(/Enter your M-Pesa PIN to pay KES/)).toBeVisible();
    await expect(page.getByText(/The request expires in \d:\d\d/)).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoA11yViolations(page);

    await page.getByRole("button", { name: "Simulate payment success" }).click();
    await expect(page.getByRole("status").filter({ hasText: /Callback applied/ })).toBeVisible();

    await page.waitForURL(/\/orders\/SFN-\d{8}-\d{4}\?token=/);
    await expect(page.getByText("Order confirmed", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Payment received. We are preparing your order.")).toBeVisible();
    await expect(page.getByText("Payment confirmed")).toBeVisible();
    await expect(page.getByRole("button", { name: "Pay another way" })).toHaveCount(0);
  });

  test("M-Pesa: cancellation is honest, retry works, and the order can switch to cash on delivery", async ({ page }) => {
    await startCheckout(page);
    await chooseCollection(page);
    await page.getByRole("button", { name: "Review order" }).click();
    await page.getByRole("button", { name: /with M-Pesa$/ }).click();
    await expect(page.getByRole("heading", { name: "Check your phone" })).toBeVisible();

    await page.getByRole("button", { name: "Simulate cancellation" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Payment not completed" })).toBeVisible();
    await expect(page.getByText("Nothing was charged.")).toBeVisible();

    // Retry re-sends the prompt on the same order (no second order, cart untouched).
    await page.getByRole("button", { name: "Send the request again" }).click();
    await expect(page.getByText(/The request expires in 2:00|The request expires in 1:5\d/)).toBeVisible();

    // Switch the same order to cash on delivery.
    await page.getByRole("button", { name: "Pay another way" }).click();
    await expect(page.getByRole("heading", { name: "Pay another way" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^M-Pesa/ })).toHaveCount(0);
    await page.getByRole("button", { name: /Cash or M-Pesa on delivery/ }).click();

    await page.waitForURL(/\/orders\/SFN-\d{8}-\d{4}\?token=/);
    await expect(page.getByText("Order confirmed. Pay the rider when it arrives.")).toBeVisible();
    await expect(page.getByText("Payment cancelled", { exact: true })).toBeVisible();
    await expect(page.getByText("Payment method changed")).toBeVisible();
  });

  test("card: redirect, return page, simulated success", async ({ page }) => {
    await startCheckout(page);
    await chooseCollection(page);
    await page.getByLabel(/Card \(Visa, Mastercard\)/).check();
    await page.getByRole("button", { name: "Review order" }).click();
    await expect(page.getByText("Card payment (Visa/Mastercard via Paystack)")).toBeVisible();
    await page.getByRole("button", { name: /^Pay KES [\d,.]+ by card$/ }).click();

    await page.waitForURL(/\/checkout\/return\?/);
    await expect(page.getByRole("heading", { name: "Confirming your card payment" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoA11yViolations(page);

    await page.getByRole("button", { name: "Simulate payment success" }).click();
    await page.waitForURL(/\/orders\/SFN-\d{8}-\d{4}\?token=/);
    await expect(page.getByText("Payment received. We are preparing your order.")).toBeVisible();
  });

  test("card: cancellation, then the tracking page switches the same order to cash on delivery", async ({ page }) => {
    await startCheckout(page);
    await chooseCollection(page);
    await page.getByLabel(/Card \(Visa, Mastercard\)/).check();
    await page.getByRole("button", { name: "Review order" }).click();
    await page.getByRole("button", { name: /by card$/ }).click();
    await page.waitForURL(/\/checkout\/return\?/);

    await page.getByRole("button", { name: "Simulate cancellation" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Card payment not completed" })).toBeVisible();
    await page.getByRole("link", { name: "Pay another way or try again" }).click();

    await page.waitForURL(/\/orders\/SFN-\d{8}-\d{4}\?token=/);
    await expect(page.getByText("Order saved, payment outstanding")).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "Payment incomplete" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Pay KES [\d,.]+ by card$/ })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoA11yViolations(page);

    await page.getByRole("button", { name: "Pay another way" }).click();
    await expect(page.getByRole("heading", { name: "Pay another way" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Card/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByRole("button", { name: "Pay another way" })).toBeVisible();
    await page.getByRole("button", { name: "Pay another way" }).click();
    await page.getByRole("button", { name: /Cash or M-Pesa on delivery/ }).click();

    await page.waitForURL(/\/orders\/SFN-\d{8}-\d{4}\?token=/);
    await expect(page.getByText("Order confirmed. Pay the rider when it arrives.")).toBeVisible();
    await expect(page.getByText("Payment method changed")).toBeVisible();
    await expect(page.getByRole("button", { name: "Pay another way" })).toHaveCount(0);
  });

  test("keyboard only: the whole wizard can be completed without a pointer", async ({ page }) => {
    await addToCart(page);
    await page.goto("/checkout");
    await page.getByLabel("Full name").focus();
    await page.keyboard.type("Amina Mwangi");
    await page.keyboard.press("Tab");
    await page.keyboard.type("amina@example.test");
    await page.keyboard.press("Tab");
    await page.keyboard.type("0712345678");
    await page.getByRole("button", { name: "Continue to delivery" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "2. Delivery & collection" })).toBeVisible();

    await page.getByLabel(/Collection \(Free\)/).focus();
    await page.keyboard.press("Space");
    await expect(page.getByLabel(/Collection \(Free\)/)).toBeChecked();
    await page.getByRole("button", { name: "Continue to payment" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "3. Payment method" })).toBeVisible();

    await page.getByLabel("Cash on delivery").focus();
    await page.keyboard.press("Space");
    await page.getByRole("button", { name: "Review order" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "4. Review and place order" })).toBeVisible();
    await page.getByRole("button", { name: "Place order (Cash on delivery)" }).focus();
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/orders\/SFN-\d{8}-\d{4}\?token=/);
    await expect(page.getByText("Order confirmed. Pay the rider when it arrives.")).toBeVisible();
  });
});
