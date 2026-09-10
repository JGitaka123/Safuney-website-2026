import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations, expectNoHorizontalOverflow } from "./helpers";

const PRODUCT = "/products/disinfection/saf-quartsan";

function freshPhone(): string {
  return `07${String(Date.now() + Math.floor(Math.random() * 1000)).slice(-8)}`;
}

async function signInWithCode(page: Page, phone: string, next = "/account") {
  await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Mobile number").fill(phone);
  await page.getByRole("button", { name: "Send the code" }).click();
  const code = await page.getByText("Your code is").locator("span").textContent();
  await page.getByLabel("Sign-in code").fill(code!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => u.pathname === next);
}

test.describe("address book", () => {
  test("saves an address, uses it at checkout, and the order carries the recipient", async ({ page }) => {
    await signInWithCode(page, freshPhone(), "/account/addresses");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Delivery addresses");
    await expectNoHorizontalOverflow(page);
    await expectNoA11yViolations(page);

    await page.getByLabel("Label").fill("Kitchen store");
    await page.getByLabel("Who receives it").fill("Chef Otieno");
    await page.getByLabel("Their phone").fill("0733000111");
    await page.getByLabel("County", { exact: true }).selectOption("Nairobi");
    await page.getByLabel("Town, estate or area").fill("Westlands");
    await page.getByLabel("Street, building or unit").fill("Waiyaki Way, Block C");
    await page.getByLabel("Nearby landmark").fill("Opposite the petrol station");
    await page.getByRole("button", { name: "Save address" }).click();
    await expect(page.getByText("Address saved.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "Kitchen store" })).toBeVisible();
    await expect(page.getByText("Default", { exact: true })).toBeVisible();
    await expectNoA11yViolations(page);

    // Checkout picks the saved address and fills the delivery fields.
    await page.goto(PRODUCT);
    await page.getByRole("radio", { name: /5 L/ }).check();
    await page.getByRole("button", { name: "Add to cart" }).click();
    await expect(page.getByText(/Added 1 ×/)).toBeVisible();
    await page.goto("/checkout");
    await page.getByLabel("Full name").fill("Buyer Person");
    await page.getByLabel("Email address").fill("buyer.person@example.test");
    await page.getByRole("button", { name: "Continue to delivery" }).click();
    await expect(page.getByLabel("Saved address")).toHaveValue(/./);
    await expect(page.getByLabel("Town, Estate or Sub-county")).toHaveValue("Westlands");
    await expect(page.getByLabel("Street, Building or Unit")).toHaveValue("Waiyaki Way, Block C");
    await page.getByRole("button", { name: "Continue to payment" }).click();
    await page.getByLabel("Cash on delivery").check();
    await page.getByRole("button", { name: "Review order" }).click();
    await expect(page.getByText(/Westlands, Nairobi, Waiyaki Way, Block C/)).toBeVisible();
    await page.getByRole("button", { name: "Place order (Cash on delivery)" }).click();
    await page.waitForURL(/\/orders\/SFN-\d{8}-\d{4}\?token=/);
    await expect(page.getByText("Chef Otieno")).toBeVisible();
    await expect(page.getByText("Westlands, Nairobi")).toBeVisible();

    // A second address, made default, then the first removed.
    await page.goto("/account/addresses");
    await page.getByLabel("Label").fill("Receiving bay");
    await page.getByLabel("Who receives it").fill("Security desk");
    await page.getByLabel("Their phone").fill("0733000222");
    await page.getByLabel("County", { exact: true }).selectOption("Kiambu");
    await page.getByLabel("Town, estate or area").fill("Ruiru");
    await page.getByRole("button", { name: "Save address" }).click();
    await expect(page.getByRole("heading", { level: 3, name: "Receiving bay" })).toBeVisible();
    await page.getByRole("button", { name: "Make default" }).click();
    await expect(page.getByRole("article").filter({ hasText: "Receiving bay" }).getByText("Default")).toBeVisible();
    const kitchen = page.getByRole("article").filter({ hasText: "Kitchen store" });
    await kitchen.getByRole("button", { name: "Remove" }).click();
    await kitchen.getByRole("button", { name: "Yes, remove it" }).click();
    await expect(page.getByRole("heading", { level: 3, name: "Kitchen store" })).toHaveCount(0);
  });
});
