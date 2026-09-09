import { expect, test } from "@playwright/test";
import { expectNoA11yViolations, expectNoHorizontalOverflow } from "./helpers";
import { staffSessionPath } from "./session";

/**
 * Phase 8 features are all behind flags that default to off, and the rule is that off means
 * unreachable rather than merely unlinked. These tests run against the default state, so they assert
 * the refusal — which is the property that actually matters before the PO has seen a demo.
 */
const FLAGGED = ["/advisor", "/planner", "/compliance", "/reps", "/account/statement"];

test.describe("flagged features", () => {
  for (const path of FLAGGED) {
    test(`${path} is unreachable while its flag is off`, async ({ page }) => {
      const response = await page.goto(path);
      const status = response?.status() ?? 0;
      // 404 for a public feature, or a redirect to sign-in for one that needs an account first.
      const signIn = /\/sign-in/.test(page.url());
      expect(status === 404 || signIn, `${path} returned ${status} at ${page.url()}`).toBe(true);
    });
  }

  test("the manifest is served and names the app", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest");
    expect(response.status()).toBe(200);
    const manifest = (await response.json()) as { name: string; start_url: string; display: string };
    expect(manifest.name).toContain("Safuney");
    expect(manifest.display).toBe("standalone");
  });

  test("no service worker is registered while the PWA flag is off", async ({ page }) => {
    await page.goto("/");
    // A worker registered under a flag that is off would outlive the flag; PwaRegister unregisters it.
    const registrations = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return 0;
      return (await navigator.serviceWorker.getRegistrations()).length;
    });
    expect(registrations).toBe(0);
  });

  test("the service worker never caches a priced or personalised path", async ({ page }) => {
    // Read the shipped worker and check the exclusion list rather than the comment above it.
    const response = await page.request.get("/sw.js");
    expect(response.status()).toBe(200);
    const source = await response.text();
    for (const path of ["/api/", "/cart", "/checkout", "/account", "/admin", "/orders", "/sign-in"]) {
      expect(source, `${path} must never be cached`).toContain(`"${path}"`);
    }
    // And the cookie rule, which is what covers paths nobody has thought of yet.
    expect(source).toContain('request.headers.get("cookie")');
  });
});

/** The admin screen the PO uses to switch these on. */
test.describe("feature administration", () => {
  test.describe.configure({ mode: "serial" });
  test.use({ storageState: staffSessionPath("admin") });

  test("lists every feature, off, with a description the PO can act on", async ({ page }) => {
    await page.goto("/admin/flags");
    await expect(page.getByRole("heading", { name: "Features", level: 1 })).toBeVisible();
    await expect(page.getByText("Not visible to customers").first()).toBeVisible();
    await expect(page.getByText(/AI product advisor/)).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoA11yViolations(page);
  });

  test("switching one on makes the page reachable, and off makes it a 404 again", async ({ page }) => {
    await page.goto("/admin/flags");
    const row = page.getByRole("listitem").filter({ hasText: "planner.enabled" });
    await row.getByRole("button", { name: /switch on/i }).click();
    await expect(row.getByText("Live for every customer")).toBeVisible();

    const opened = await page.goto("/planner");
    expect(opened?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Facility hygiene planner", level: 1 })).toBeVisible();

    // And it actually works: a real estimate, not an empty shell.
    await page.getByLabel("Guest rooms").fill("40");
    await page.getByRole("button", { name: "Plan it" }).click();
    await expect(page.getByRole("heading", { name: /Hotel or lodge, 40 guest rooms/ })).toBeVisible();
    await expect(page.getByText(/of concentrate/)).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoA11yViolations(page);

    await page.goto("/admin/flags");
    const again = page.getByRole("listitem").filter({ hasText: "planner.enabled" });
    await again.getByRole("button", { name: /switch off/i }).click();
    await expect(again.getByText("Not visible to customers")).toBeVisible();
    const closed = await page.goto("/planner");
    expect(closed?.status()).toBe(404);
  });

});

/** Sales can reach the console but must not be able to switch a feature on for every customer. */
test.describe("feature administration as sales", () => {
  test.describe.configure({ mode: "serial" });
  test.use({ storageState: staffSessionPath("sales") });

  test("only an administrator can switch a feature on", async ({ page }) => {
    await page.goto("/admin/flags");
    await expect(page).toHaveURL(/\/account\?denied=1/);
  });
});
