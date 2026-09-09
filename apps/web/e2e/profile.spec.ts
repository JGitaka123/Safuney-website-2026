import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations, expectNoHorizontalOverflow } from "./helpers";

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

test.describe("profile and privacy", () => {
  test("updates details, exports data, refuses a wrong confirmation, then deletes the account", async ({ page }) => {
    const phone = freshPhone();
    await signInWithCode(page, phone, "/account/profile");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Profile and privacy");
    await expectNoHorizontalOverflow(page);
    await expectNoA11yViolations(page);

    await page.getByLabel("Name").fill("Wanjiru Kamau");
    await page.getByLabel("Email address").fill(`wanjiru-${Date.now().toString(36)}@example.test`);
    await page.getByLabel("Send me product news and offers by email.").check();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(/^Saved\./)).toBeVisible();

    const res = await page.request.get("/account/export");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-disposition"]).toContain("safuney-account-");
    const data = (await res.json()) as { user: { name: string; phone: string }; orders: unknown[] };
    expect(data.user.name).toBe("Wanjiru Kamau");
    expect(data.user.phone).toBe(`+254${phone.slice(1)}`);

    await page.getByLabel("Type DELETE to confirm").fill("nope");
    await page.getByRole("button", { name: "Delete my account" }).click();
    await expect(page.getByText("Type DELETE to confirm.")).toBeVisible();
    await page.getByLabel("Type DELETE to confirm").fill("DELETE");
    await page.getByRole("button", { name: "Delete my account" }).click();
    await page.waitForURL((u) => u.pathname === "/" && u.searchParams.get("deleted") === "1");
    await expect(page.getByRole("link", { name: "Sign in" }).first()).toBeVisible();

    // The old number no longer signs in to that account: a fresh, empty account is created instead.
    await signInWithCode(page, phone, "/account");
    await expect(page.getByText("No orders yet")).toBeVisible();
  });
});
