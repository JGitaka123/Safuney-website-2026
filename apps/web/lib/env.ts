/**
 * Runtime configuration. Everything here is read from environment variables that live in Vercel
 * (and apps/web/.env.local for local dev). Nothing is hard-coded, and features that depend on a
 * service switch themselves off when that service is not configured.
 */
const env = process.env;

function has(...keys: string[]): boolean {
  return keys.every((k) => typeof env[k] === "string" && env[k]!.length > 0);
}

export const services = {
  database: () => has("DATABASE_URL"),
  email: () => has("RESEND_API_KEY"),
  redis: () => has("UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN") || has("KV_REST_API_URL", "KV_REST_API_TOKEN"),
} as const;

export const config = {
  /** Sender used by Resend. Must be on a verified domain in Resend. */
  emailFrom: env["EMAIL_FROM"] ?? "Safuney website <no-reply@safuney.com>",
  /** Where contact-form leads are emailed. */
  leadsInbox: env["LEADS_INBOX"] ?? "info@safuney.com",
  siteUrl: env["NEXT_PUBLIC_SITE_URL"] ?? (env["VERCEL_URL"] ? `https://${env["VERCEL_URL"]}` : "http://localhost:3000"),
  isProduction: env["VERCEL_ENV"] === "production",
  redis: {
    url: env["UPSTASH_REDIS_REST_URL"] ?? env["KV_REST_API_URL"],
    token: env["UPSTASH_REDIS_REST_TOKEN"] ?? env["KV_REST_API_TOKEN"],
  },
} as const;
