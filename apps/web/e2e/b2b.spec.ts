import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations, expectNoHorizontalOverflow } from "./helpers";

const PRODUCT = "/products/disinfection/qac-surface-food-contact-sanitiser";
const STAFF_PASSWORD = process.env["DEMO_STAFF_PASSWORD"] ?? "safuney-demo-2026";

/** A fresh Safaricom-style number per run so the journeys are repeatable against a persistent database. */
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

async function signInWithEmailCode(page: Page, email: string, next = "/account") {
  await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
  await page.getByRole("radio", { name: "Email" }).click();
  await page.getByLabel("Email address").fill(email);
  // In mock mode without Resend the email option sends a code, not a link.
  await page.getByRole("button", { name: /Email me a (code|link)/ }).click();
  const code = await page.getByText("Your code is").locator("span").textContent();
  await page.getByLabel("Sign-in code").fill(code!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => u.pathname === next);
}

async function signOut(page: Page) {
  await page.goto("/account");
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL((u) => u.pathname === "/");
}

async function addToCart(page: Page, qty = 1) {
  await page.goto(PRODUCT);
  await page.getByRole("radio", { name: /1 L/ }).check();
  if (qty > 1) await page.getByRole("spinbutton", { name: /Quantity/ }).fill(String(qty));
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByText(/Added \d+ ×/)).toBeVisible();
}

async function checkoutCod(page: Page, name: string) {
  await page.goto("/checkout");
  await page.getByLabel("Full name").fill(name);
  if (!(await page.getByLabel("Email address").inputValue())) await page.getByLabel("Email address").fill(`${name.toLowerCase().replace(/\s+/g, ".")}@example.test`);
  if (!(await page.getByLabel("Phone number").inputValue())) await page.getByLabel("Phone number").fill("0722000333");
  await page.getByRole("button", { name: "Continue to delivery" }).click();
  await page.getByLabel(/Collection \(Free\)/).check();
  await page.getByRole("button", { name: "Continue to payment" }).click();
  await page.getByLabel("Cash on delivery").check();
  await page.getByRole("button", { name: "Review order" }).click();
  await page.getByRole("button", { name: "Place order (Cash on delivery)" }).click();
  await page.waitForURL(/\/orders\/SFN-\d{8}-\d{4}\?token=/);
  return /SFN-\d{8}-\d{4}/.exec(page.url())![0];
}

test.describe("organisation accounts", () => {
  test("owner creates an organisation, sets a threshold, invites a buyer; the buyer's large order waits and the owner approves it", async ({ page }) => {
    const stamp = Date.now().toString(36);
    const buyerEmail = `buyer-${stamp}@example.test`;
    const ownerPhone = freshPhone();

    // Owner
    await signInWithCode(page, ownerPhone, "/account/organisation/new");
    await page.getByLabel("Organisation name").fill(`Test Hotel ${stamp}`);
    await page.getByLabel("KRA PIN").fill("P051234567X");
    await page.getByLabel("Approval threshold (KES)").fill("1,000");
    await page.getByRole("button", { name: "Create the organisation" }).click();
    await page.waitForURL(/\/account\/organisation\?created=/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Test Hotel ${stamp}`);
    await expectNoHorizontalOverflow(page);
    await expectNoA11yViolations(page);

    await page.getByLabel("Work email").fill(buyerEmail);
    await page.getByLabel("Role", { exact: true }).selectOption("BUYER");
    await page.getByRole("button", { name: "Add member" }).click();
    await expect(page.getByText(/They get access the first time they sign in/)).toBeVisible();
    await expect(page.getByText(buyerEmail, { exact: true })).toBeVisible();
    await signOut(page);

    // Buyer: 2 × KES 380 + VAT = 881.60 < 1,000 goes straight through; 3 × = 1,322.40 waits.
    await signInWithEmailCode(page, buyerEmail, "/account");
    await expect(page.getByText(`Test Hotel ${stamp}`)).toBeVisible();
    await addToCart(page, 3);
    await page.goto("/checkout");
    await expect(page.getByText(/orders of KES 1,000.00 and above go to an approver/)).toBeVisible();
    const number = await checkoutCod(page, "Buyer Person");
    await expect(page.getByText("Order waiting for approval")).toBeVisible();
    await expect(page.getByText(/Waiting for an approver in your organisation/)).toBeVisible();
    await page.goto("/account/approvals");
    await expect(page.getByText(`Your order of KES 1,322.40 is waiting for an approver.`)).toBeVisible();
    await signOut(page);

    // Owner approves.
    await signInWithCode(page, ownerPhone, "/account/approvals");
    const card = page.getByRole("article", { name: number });
    await expect(card).toBeVisible();
    await expectNoA11yViolations(page);
    await card.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(card.getByText("Approved and confirmed.")).toBeVisible();
    await page.goto("/account");
    await expect(page.getByRole("link", { name: number })).toHaveCount(0); // the buyer's order, not the owner's
    await signOut(page);
  });

  test("saved list from an order, add all to cart, and a scheduled delivery from the cart", async ({ page }) => {
    await signInWithCode(page, freshPhone(), "/account");
    await addToCart(page, 2);
    const number = await checkoutCod(page, "List Person");
    await page.goto("/account");
    await page.getByRole("button", { name: "Save as list" }).first().click();
    await page.waitForURL(/\/account\/lists\//);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Order ${number}`);
    await expect(page.getByRole("spinbutton", { name: /Quantity of/ })).toHaveValue("2");
    await expectNoHorizontalOverflow(page);
    await expectNoA11yViolations(page);
    await page.getByRole("button", { name: "Add all to cart" }).click();
    await page.waitForURL((u) => u.pathname === "/cart");
    await expect(page.getByRole("link", { name: /Cart, 2 items/ }).first()).toBeVisible();

    await page.goto("/account/deliveries");
    await expect(page.getByText(/QAC-based sanitiser.*× 2/)).toBeVisible();
    await page.getByLabel("How often").selectOption("28");
    await page.getByRole("button", { name: "Start the schedule" }).click();
    await expect(page.getByText(/Scheduled\. We email you three days before/)).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "Every four weeks" })).toBeVisible();
    await page.getByRole("button", { name: "Skip the next one" }).click();
    await expect(page.getByText(/Skipped\./)).toBeVisible();
    await page.getByRole("button", { name: "Pause" }).click();
    await expect(page.getByText("Paused")).toBeVisible();
    await expectNoA11yViolations(page);
    await signOut(page);
  });

  test("quote: customer requests, sales prices it, customer accepts and the order carries the quoted price", async ({ page }) => {
    const stamp = Date.now().toString(36);
    const email = `quoter-${stamp}@example.test`;
    await page.goto("/quote");
    await expectNoHorizontalOverflow(page);
    await expectNoA11yViolations(page);
    await page.getByLabel("Your name").fill("Quote Person");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Phone number").fill("0722000666");
    await page.getByLabel("Line 1").fill("QAC sanitiser 1 L, pallet");
    await page.getByLabel("Qty").first().fill("10");
    await page.getByRole("button", { name: "Send the request" }).click();
    await expect(page.getByText(/Request QUO-\d{8}-\d{4} received/)).toBeVisible();

    // Sales prices it.
    await page.goto("/sign-in/staff");
    await page.getByLabel("Work email").fill("sales@safuney.test");
    await page.getByLabel("Password", { exact: true }).fill(STAFF_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL((u) => u.pathname === "/sales");
    await expectNoA11yViolations(page);
    await page.getByRole("link", { name: "Quotes to price" }).click();
    const row = page.getByRole("row").filter({ hasText: email });
    const quoteNumber = (await row.getByRole("link").first().textContent())!.trim();
    await row.getByRole("link").first().click();
    await page.getByLabel("SKU", { exact: true }).fill("QAC-SURFACE-FOOD-CONTACT-SANITISER-1L");
    await page.getByLabel("Unit price ex VAT (KES)").fill("350");
    await page.getByLabel("Note to the customer").fill("Pallet price, valid two weeks.");
    await page.getByRole("button", { name: "Send the quote" }).click();
    await expect(page.getByText("Priced and sent.")).toBeVisible();
    const quote = await page.request.get(`/api/test/quote-link?number=${quoteNumber}`);
    const { token } = (await quote.json()) as { token: string };
    await page.goto("/account");
    await page.getByRole("button", { name: "Sign out" }).click();

    // Customer accepts.
    await page.goto(`/quotes/${quoteNumber}?token=${token}`);
    await expect(page.getByText("Your quote is ready")).toBeVisible();
    await expect(page.getByText("Pallet price, valid two weeks.")).toBeVisible();
    await expect(page.getByRole("cell", { name: "KES 3,500.00" })).toBeVisible(); // 10 × 350 ex VAT
    await expectNoA11yViolations(page);
    await page.getByLabel("Pay by").selectOption("COD");
    await page.getByRole("button", { name: "Accept and place the order" }).click();
    await page.waitForURL(/\/orders\/SFN-\d{8}-\d{4}\?token=/);
    await expect(page.getByText("KES 4,060.00").filter({ visible: true }).first()).toBeVisible(); // 10 × 350 + VAT
    await expect(page.getByText("Order confirmed. Pay the rider when it arrives.")).toBeVisible();
  });
});
