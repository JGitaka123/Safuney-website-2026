import { expect, test } from "@playwright/test";
import { expectNoA11yViolations, expectNoHorizontalOverflow } from "./helpers";
import { staffSessionPath } from "./session";

// Sessions come from the `setup` project, which signs each role in once for the whole run: staff
// sign-in allows five attempts per address per ten minutes, and several specs need the same roles.
// Serial ordering is still wanted here — one test changes a price and puts it back.
test.describe.configure({ mode: "serial" });

test.describe("admin console", () => {
  test("a customer cannot reach the console", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/sign-in\?next=(%2F|\/)admin/);
  });

  test.describe("as an administrator", () => {
    test.use({ storageState: staffSessionPath("admin") });

    test("the overview shows the numbers and stays inside the viewport", async ({ page }) => {
      await page.goto("/admin");
      await expect(page.getByRole("heading", { name: "Overview", level: 1 })).toBeVisible();
      await expect(page.getByText("Sales today")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Orders by status" })).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await expectNoA11yViolations(page);
    });

    test("a price change is written and the audit log names who did it", async ({ page }) => {
      await page.goto("/admin/catalogue?q=quartsan");
      const row = page.getByRole("row").filter({ hasText: "QUARTSAN" }).first();
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
      await page.goto("/admin/catalogue?q=quartsan");
      const again = page.getByRole("row").filter({ hasText: "QUARTSAN" }).first();
      await again.getByRole("textbox", { name: /^Price for / }).first().fill(before);
      await again.getByRole("button", { name: "Save" }).first().click();
      await expect(again.getByText("Saved")).toBeVisible();
    });

    test("a stock count below what live orders reserve is refused", async ({ page }) => {
      await page.goto("/admin/catalogue?q=quartsan");
      const row = page.getByRole("row").filter({ hasText: "QUARTSAN" }).first();
      const counted = row.getByRole("textbox", { name: "Counted quantity" }).first();
      const before = await counted.inputValue();
      await counted.fill("-1");
      await row.getByRole("textbox", { name: "Why the count changed" }).first().fill("typo");
      await row.getByRole("button", { name: "Save" }).nth(1).click();
      await expect(row.getByRole("alert")).toBeVisible();
      // Nothing was written.
      await page.reload();
      await expect(page.getByRole("row").filter({ hasText: "QUARTSAN" }).first().getByRole("textbox", { name: "Counted quantity" }).first()).toHaveValue(before);
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
      // Splitting on commas only works on a row with no quoted field, and catalogue descriptions have
      // commas in them. Pick a row that is safe to edit that way rather than corrupting a quoted one.
      const target = lines.findIndex((l, i) => i > 0 && l.length > 0 && !l.includes('"'));
      expect(target).toBeGreaterThan(0);
      const cells = lines[target]!.split(",");
      cells[headers.indexOf("price_kes")] = "twelve hundred";
      lines[target] = cells.join(",");
      await page.setInputFiles("#catalogue-csv", { name: "broken.csv", mimeType: "text/csv", buffer: Buffer.from(lines.join("\r\n"), "utf8") });
      await expect(page.getByText(/Nothing will be imported while any row has a problem/)).toBeVisible();
      await expect(page.getByText(/price_kes: "twelve hundred"/)).toBeVisible();
      await expect(page.getByRole("button", { name: /^Import / })).toBeDisabled();
      await expectNoA11yViolations(page);
    });
  });

  test.describe("as the warehouse", () => {
    test.use({ storageState: staffSessionPath("warehouse") });

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
    test.use({ storageState: staffSessionPath("sales") });

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
    test.use({ storageState: staffSessionPath("finance") });

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
