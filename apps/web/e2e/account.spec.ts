import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations, expectNoHorizontalOverflow } from "./helpers";

const PRODUCT = "/products/disinfection/saf-quartsan";

/** Runs in mock mode: the SMS code is shown on the page instead of being sent. */
async function signInWithCode(page: Page, phone: string, next = "/account") {
  await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in");
  await page.getByLabel("Mobile number").fill(phone);
  await page.getByRole("button", { name: "Send the code" }).click();
  const code = await page.getByText("Your code is").locator("span").textContent();
  expect(code).toMatch(/^\d{6}$/);
  await page.getByLabel("Sign-in code").fill(code!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => u.pathname === next);
}

test.describe("account", () => {
  test("sign-in page validates, shows the test code, and rejects a wrong code", async ({ page }) => {
    await page.goto("/sign-in");
    await expectNoHorizontalOverflow(page);
    await expectNoA11yViolations(page);
    await page.getByLabel("Mobile number").fill("12345");
    await page.getByRole("button", { name: "Send the code" }).click();
    await expect(page.getByText(/does not look like a Kenyan mobile number/)).toBeVisible();
    await page.getByLabel("Mobile number").fill("0722000111");
    await page.getByRole("button", { name: "Send the code" }).click();
    await expect(page.getByText("Your code is")).toBeVisible();
    await page.getByLabel("Sign-in code").fill("000000");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "wrong or has expired" })).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test("signs in with a code, keeps the guest cart, sees the order in the account, signs out", async ({ page }) => {
    // Guest adds to the cart first; the cart must survive sign-in.
    await page.goto(PRODUCT);
    await page.getByRole("radio", { name: /5 L/ }).check();
    await page.getByRole("button", { name: "Add to cart" }).click();
    await expect(page.getByText(/Added 1 ×/)).toBeVisible();

    await signInWithCode(page, "0722000222", "/cart");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your cart");
    await expect(page.getByRole("link", { name: /Cart, 1 item/ }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Account" }).first()).toBeVisible();

    // Place an order while signed in: it is attached to the account.
    await page.goto("/checkout");
    await page.getByLabel("Full name").fill("Wanjiru Kamau");
    await page.getByLabel("Email address").fill("wanjiru@example.test");
    await page.getByLabel("Phone number").fill("0722000222");
    await page.getByRole("button", { name: "Continue to delivery" }).click();
    await page.getByLabel(/Collection \(Free\)/).check();
    await page.getByRole("button", { name: "Continue to payment" }).click();
    await page.getByLabel("Cash on delivery").check();
    await page.getByRole("button", { name: "Review order" }).click();
    await page.getByRole("button", { name: "Place order (Cash on delivery)" }).click();
    await page.waitForURL(/\/orders\/SFN-\d{8}-\d{4}\?token=/);
    const number = /SFN-\d{8}-\d{4}/.exec(page.url())![0];

    await page.goto("/account");
    await expect(page.getByRole("heading", { level: 2, name: "Orders" })).toBeVisible();
    await expect(page.getByRole("link", { name: number })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoA11yViolations(page);

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL((u) => u.pathname === "/");
    await expect(page.getByRole("link", { name: "Sign in" }).first()).toBeVisible();
    await page.goto("/account");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount/);
  });

  test("staff sign-in rejects unknown credentials and customer accounts", async ({ page }) => {
    await page.goto("/sign-in/staff");
    await page.getByLabel("Work email").fill("nobody@safuney.com");
    await page.getByLabel("Password", { exact: true }).fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "not recognised" })).toBeVisible();
    await expectNoA11yViolations(page);
  });
});
