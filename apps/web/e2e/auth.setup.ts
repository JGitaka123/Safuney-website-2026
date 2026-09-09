import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { expect, test as setup } from "@playwright/test";
import { STAFF_ROLES, staffSessionPath, STAFF_PASSWORD } from "./session";

/**
 * Signs each staff role in once for the whole run.
 *
 * Staff sign-in is rate limited to five attempts per address per ten minutes. That is the right limit
 * and not one to relax for tests — but several specs need the same roles, and signing in per spec (or
 * per test) spends the budget and fails the run for a reason that has nothing to do with the code under
 * test. This runs first, writes a storage state per role, and every spec reuses it. Four sign-ins per
 * run, however many specs there are.
 */
setup("sign in each staff role once", async ({ browser, baseURL }) => {
  mkdirSync(dirname(staffSessionPath("probe")), { recursive: true });
  for (const role of STAFF_ROLES) {
    const context = await browser.newContext({ baseURL, storageState: undefined });
    const page = await context.newPage();
    await page.goto("/sign-in/staff?next=%2Fadmin");
    await page.getByLabel("Work email").fill(`${role}@safuney.test`);
    await page.getByLabel("Password", { exact: true }).fill(STAFF_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    // WAREHOUSE has no admin permission, so it lands on /account?denied=1 rather than /admin. Either
    // is a successful sign-in; still being on /sign-in/staff is not.
    await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"), { timeout: 20_000 });
    await expect(page.getByLabel("Work email")).toHaveCount(0);
    await context.storageState({ path: staffSessionPath(role) });
    await context.close();
  }
});
