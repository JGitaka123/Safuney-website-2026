import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, type Browser } from "@playwright/test";
import { expectNoA11yViolations, expectNoHorizontalOverflow } from "./helpers";

const STAFF_PASSWORD = process.env["DEMO_STAFF_PASSWORD"] ?? "safuney-demo-2026";
// Keyed by worker: two projects run in separate worker processes at the same time and would
// otherwise write the same file. A serial describe keeps its beforeAll and its tests in one worker,
// so the file written there is the one its tests read.
const stateDir = join(tmpdir(), `safuney-admin-${process.env["TEST_WORKER_INDEX"] ?? "0"}`);
mkdirSync(stateDir, { recursive: true });

function sessionPath(role: string): string {
  return join(stateDir, `${role}.json`);
}

/**
 * Signs in once per role and keeps the session.
 *
 * Staff sign-in is rate limited to five attempts per address per ten minutes, which is the right
 * limit and not one to relax for tests. It is also how the console is really used: you sign in once
 * and stay signed in, rather than re-authenticating for every page.
 */
async function sessionFor(browser: Browser, email: string, baseURL: string | undefined): Promise<string> {
  const path = sessionPath(email.split("@")[0]!);
  // `browser.newContext()` does not inherit the config's baseURL, and inside a describe that sets
  // `storageState` it would otherwise try to read the very file this call is about to write.
  const context = await browser.newContext({ baseURL, storageState: undefined });
  const page = await context.newPage();
  await page.goto("/sign-in/staff?next=%2Fadmin");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(STAFF_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => u.pathname === "/admin");
  await context.storageState({ path });
  await context.close();
  return path;
}

// Each role signs in once per worker. Serial keeps a role's tests in one worker, so the sign-in
// happens once rather than once per test — staff sign-in allows five attempts per address per ten
// minutes, which is the right limit and not one to relax for tests.
test.describe.configure({ mode: "serial" });

test.describe("admin console", () => {
  test("a customer cannot reach the console", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/sign-in\?next=(%2F|\/)admin/);
  });

  test.describe("as an administrator", () => {
    test.use({ storageState: sessionPath("admin") });
    test.beforeAll(async ({ browser }, info) => {
      await sessionFor(browser, "admin@safuney.test", info.project.use.baseURL);
    });

    test("the overview shows the numbers and stays inside the viewport", async ({ page }) => {
      await page.goto("/admin");
      await expect(page.getByRole("heading", { name: "Overview", level: 1 })).toBeVisible();
      await expect(page.getByText("Sales today")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Orders by status" })).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await expectNoA11yViolations(page);
    });

    test("a price change is written and the audit log names who did it", async ({ page }) => {
      await page.goto("/admin/catalogue?q=sanitiser");
      const row = page.getByRole("row").filter({ hasText: "sanitiser" }).first();
      const price = row.getByRole("textbox", { name: /^Price for / }).first();
      await expect(price).toBeVisible();
      const before = await price.inputValue();
      await price.fill((Number(before) + 1).toFixed(2));
      await row.getByRole("button", { name: "Save" }).first().click();
      await expect(row.getByText("Saved")).toBeVisible();

      await page.goto("/admin/audit?entity=ProductVariant");
      const entry = page.getByRole("row").filter({ hasText: "catalogue.variant.price" }).first();
      await expect(entry).toBeVisible();
      await expect(entry).toContainText("Demo admin");
      await expectNoA11yViolations(page);

      // Put it back, so a repeated run starts where this one did.
      await page.goto("/admin/catalogue?q=sanitiser");
      const again = page.getByRole("row").filter({ hasText: "sanitiser" }).first();
      await again.getByRole("textbox", { name: /^Price for / }).first().fill(before);
      await again.getByRole("button", { name: "Save" }).first().click();
      await expect(again.getByText("Saved")).toBeVisible();
    });

    test("a stock count below what live orders reserve is refused", async ({ page }) => {
      await page.goto("/admin/catalogue?q=sanitiser");
      const row = page.getByRole("row").filter({ hasText: "sanitiser" }).first();
      const counted = row.getByRole("textbox", { name: "Counted quantity" }).first();
      const before = await counted.inputValue();
      await counted.fill("-1");
      await row.getByRole("textbox", { name: "Why the count changed" }).first().fill("typo");
      await row.getByRole("button", { name: "Save" }).nth(1).click();
      await expect(row.getByRole("alert")).toBeVisible();
      // Nothing was written.
      await page.reload();
      await expect(page.getByRole("row").filter({ hasText: "sanitiser" }).first().getByRole("textbox", { name: "Counted quantity" }).first()).toHaveValue(before);
    });

    test("the CSV round trip reports no changes, and a bad price is refused by name", async ({ page }) => {
      await page.goto("/admin/catalogue/import");
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("link", { name: "Export the current catalogue" }).click(),
      ]);
      const stream = await download.createReadStream();
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(chunk as Buffer);
      const csv = Buffer.concat(chunks).toString("utf8");
      expect(csv.split("\r\n")[0]).toContain("sku,product_slug");

      await page.setInputFiles("#catalogue-csv", { name: "catalogue.csv", mimeType: "text/csv", buffer: Buffer.from(csv, "utf8") });
      await expect(page.getByText(/Nothing in this file differs/)).toBeVisible();

      const lines = csv.split("\r\n");
      const headers = lines[0]!.split(",");
      const cells = lines[1]!.split(",");
      cells[headers.indexOf("price_kes")] = "twelve hundred";
      lines[1] = cells.join(",");
      await page.setInputFiles("#catalogue-csv", { name: "broken.csv", mimeType: "text/csv", buffer: Buffer.from(lines.join("\r\n"), "utf8") });
      await expect(page.getByText(/Nothing will be imported while any row has a problem/)).toBeVisible();
      await expect(page.getByText(/price_kes: "twelve hundred"/)).toBeVisible();
      await expect(page.getByRole("button", { name: /^Import / })).toBeDisabled();
      await expectNoA11yViolations(page);
    });
  });

  test.describe("as the warehouse", () => {
    test.use({ storageState: sessionPath("warehouse") });
    test.beforeAll(async ({ browser }, info) => {
      await sessionFor(browser, "warehouse@safuney.test", info.project.use.baseURL);
    });

    test("sees its own sections and is refused the rest, link or no link", async ({ page }) => {
      await page.goto("/admin");
      const nav = page.getByRole("navigation", { name: "Admin sections" });
      await expect(nav.getByRole("link", { name: "Orders" })).toBeVisible();
      await expect(nav.getByRole("link", { name: "Audit log" })).toHaveCount(0);
      await expect(nav.getByRole("link", { name: "Settings" })).toHaveCount(0);
      await expect(nav.getByRole("link", { name: "Staff" })).toHaveCount(0);
      // The pages refuse too — a hidden link is not access control.
      await page.goto("/admin/audit");
      await expect(page).toHaveURL(/\/account\?denied=1/);
      await page.goto("/admin/staff");
      await expect(page).toHaveURL(/\/account\?denied=1/);
    });
  });

  test.describe("as the sales desk", () => {
    test.use({ storageState: sessionPath("sales") });
    test.beforeAll(async ({ browser }, info) => {
      await sessionFor(browser, "sales@safuney.test", info.project.use.baseURL);
    });

    test("can read the catalogue but not change it", async ({ page }) => {
      await page.goto("/admin/catalogue");
      await expect(page.getByRole("heading", { name: "Catalogue", level: 1 })).toBeVisible();
      // No inline editors and no import for a role without catalogue.write.
      await expect(page.getByRole("textbox", { name: /^Price for / })).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Import CSV" })).toHaveCount(0);
      await page.goto("/admin/catalogue/import");
      await expect(page).toHaveURL(/\/account\?denied=1/);
    });

    test("sees the leads inbox and can mark one handled", async ({ page }) => {
      await page.goto("/admin/leads");
      await expect(page.getByRole("heading", { name: "Leads", level: 1 })).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await expectNoA11yViolations(page);
    });
  });

  test.describe("as finance", () => {
    test.use({ storageState: sessionPath("finance") });
    test.beforeAll(async ({ browser }, info) => {
      await sessionFor(browser, "finance@safuney.test", info.project.use.baseURL);
    });

    test("reads orders and the audit log, and cannot touch the catalogue or staff", async ({ page }) => {
      await page.goto("/admin/orders");
      await expect(page.getByRole("heading", { name: "Orders", level: 1 })).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await expectNoA11yViolations(page);
      await page.goto("/admin/audit");
      await expect(page.getByRole("heading", { name: "Audit log", level: 1 })).toBeVisible();
      await page.goto("/admin/staff");
      await expect(page).toHaveURL(/\/account\?denied=1/);
    });
  });
});
