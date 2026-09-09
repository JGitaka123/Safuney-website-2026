/**
 * Sign-in without a delivery provider: on previews and in CI (PAYMENTS_MODE=mock, never production)
 * the sign-in code is shown on the page and magic links are written to the server log, so the flow
 * can be exercised end to end. Refused in production like the payments mock.
 */
export function authMockMode(): boolean {
  return process.env["PAYMENTS_MODE"] === "mock" && process.env["VERCEL_ENV"] !== "production";
}
