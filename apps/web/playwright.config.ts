import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env["PORT"] ?? 3000);
const baseURL = process.env["PLAYWRIGHT_BASE_URL"] ?? `http://127.0.0.1:${port}`;
const external = Boolean(process.env["PLAYWRIGHT_BASE_URL"]);

/**
 * Mobile is primary (non-negotiable #10): the mobile project runs first and gates the desktop one.
 * Locally and in CI the config starts `next start` on the production build; against a Vercel preview
 * set PLAYWRIGHT_BASE_URL and no server is started.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 1 : 0,
  workers: process.env["CI"] ? 2 : undefined,
  reporter: process.env["CI"] ? [["github"], ["html", { open: "never" }]] : [["list"]],
  timeout: 30_000,
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Vercel preview deployments may sit behind Deployment Protection; the bypass secret is optional.
    extraHTTPHeaders: process.env["VERCEL_AUTOMATION_BYPASS_SECRET"]
      ? { "x-vercel-protection-bypass": process.env["VERCEL_AUTOMATION_BYPASS_SECRET"] }
      : {},
    // Environments with a pre-installed Chromium (no `playwright install`) can point at it here.
    launchOptions: process.env["PLAYWRIGHT_CHROMIUM_PATH"] ? { executablePath: process.env["PLAYWRIGHT_CHROMIUM_PATH"] } : {},
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 360, height: 780 } } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } }, dependencies: ["mobile"] },
  ],
  webServer: external
    ? undefined
    : {
        command: `pnpm exec next start -p ${port}`,
        url: baseURL,
        reuseExistingServer: !process.env["CI"],
        timeout: 60_000,
        // Surface server-side errors (a 500 page says nothing) in the test output.
        stdout: "ignore",
        stderr: "pipe",
      },
});
