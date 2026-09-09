import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations, expectNoHorizontalOverflow } from "./helpers";

const PRODUCT = "/products/disinfection/qac-surface-food-contact-sanitiser";
const STAFF_PASSWORD = process.env["DEMO_STAFF_PASSWORD"] ?? "safuney-demo-2026";

async function placeCodOrder(page: Page): Promise<{ number: string; url: string }> {
  await page.goto(PRODUCT);
  await page.getByRole("radio", { name: /1 L/ }).check();
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByText(/Added 1 ×/)).toBeVisible();
  await page.goto("/checkout");
  await page.getByLabel("Full name").fill("Warehouse Test Buyer");
  await page.getByLabel("Email address").fill("wh.buyer@example.test");
  await page.getByLabel("Phone number").fill("0722000777");
  await page.getByRole("button", { name: "Continue to delivery" }).click();
  await page.getByLabel(/Collection \(Free\)/).check();
  await page.getByRole("button", { name: "Continue to payment" }).click();
  await page.getByLabel("Cash on delivery").check();
  await page.getByRole("button", { name: "Review order" }).click();
  await page.getByRole("button", { name: "Place order (Cash on delivery)" }).click();
  await page.waitForURL(/\/orders\/SFN-\d{8}-\d{4}\?token=/);
  return { number: /SFN-\d{8}-\d{4}/.exec(page.url())![0], url: page.url() };
}

async function staffSignIn(page: Page, email: string, next: string) {
  await page.goto(`/sign-in/staff?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(STAFF_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => u.pathname === next);
}

test.describe("warehouse", () => {
  test("customers are kept out of the warehouse", async ({ page }) => {
    await page.goto("/warehouse");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fwarehouse/);
  });

  test("pick, pack, dispatch, record cash, deliver; the customer's timeline follows", async ({ page }) => {
    const order = await placeCodOrder(page);
    await staffSignIn(page, "warehouse@safuney.test", "/warehouse");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Warehouse");
    await expectNoHorizontalOverflow(page);
    await expectNoA11yViolations(page);
    await page.getByRole("link", { name: new RegExp(order.number) }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(order.number);
    await expect(page.getByRole("cell", { name: "QAC-SURFACE-FOOD-CONTACT-SANITISER-1L" })).toBeVisible();
    await expectNoA11yViolations(page);

    // Each action re-renders the page into its next state.
    await page.getByRole("button", { name: "Mark packed" }).click();
    await expect(page.getByRole("button", { name: "Mark dispatched" })).toBeVisible();
    await expect(page.getByText("Packed", { exact: true })).toBeVisible();
    await page.getByLabel("Rider", { exact: true }).fill("Rider Joe");
    await page.getByLabel("Rider's phone").fill("0700000000");
    await page.getByRole("button", { name: "Mark dispatched" }).click();
    await expect(page.getByRole("button", { name: "Record collection" })).toBeVisible();
    await page.getByLabel("M-Pesa reference").fill("RKT1ABC2DE");
    await page.getByRole("button", { name: "Record collection" }).click();
    await expect(page.getByText(/Recorded: KES [\d,.]+ \(RKT1ABC2DE\)/)).toBeVisible();
    await page.getByLabel("Received by (name)").fill("Chef Otieno");
    await page.getByRole("button", { name: "Mark delivered" }).click();
    await expect(page.getByText("Delivered", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark delivered" })).toHaveCount(0);

    await page.goto(order.url);
    await expect(page.getByText("Delivered. Thank you.")).toBeVisible();
    for (const label of ["Packed", "Out for delivery", "Payment collected on delivery", "Delivered"]) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
  });
});
