/**
 * Runtime configuration. Everything here is read from environment variables that live in Vercel
 * (and apps/web/.env.local for local dev). Nothing is hard-coded, and features that depend on a
 * service switch themselves off when that service is not configured.
 */
const env = process.env;

/**
 * A variable that exists but is empty counts as unset. Hosting dashboards make this easy to do by
 * accident, and `??` alone would hand an empty string to whatever reads it — which is how an empty
 * NEXT_PUBLIC_SITE_URL once broke the whole build inside `new URL()`.
 */
function read(key: string): string | undefined {
  const value = env[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function has(...keys: string[]): boolean {
  return keys.every((k) => read(k) !== undefined);
}

export const services = {
  database: () => has("DATABASE_URL"),
  email: () => has("RESEND_API_KEY"),
  redis: () => has("UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN") || has("KV_REST_API_URL", "KV_REST_API_TOKEN"),
  /**
   * Somewhere for an enquiry to go: stored in the database, emailed to the leads inbox, or both
   * (lib/leads.ts). Without either, forms hand the enquiry to WhatsApp instead of failing.
   */
  leads: () => has("DATABASE_URL") || has("RESEND_API_KEY"),
} as const;

export const config = {
  /** Sender used by Resend. Must be on a verified domain in Resend. */
  emailFrom: read("EMAIL_FROM") ?? "Safuney website <no-reply@safuney.com>",
  /** Where contact-form leads are emailed. */
  leadsInbox: read("LEADS_INBOX") ?? "info@safuney.com",
  siteUrl: read("NEXT_PUBLIC_SITE_URL") ?? (read("VERCEL_URL") ? `https://${read("VERCEL_URL")}` : "http://localhost:3000"),
  isProduction: read("VERCEL_ENV") === "production",
  redis: {
    url: read("UPSTASH_REDIS_REST_URL") ?? read("KV_REST_API_URL"),
    token: read("UPSTASH_REDIS_REST_TOKEN") ?? read("KV_REST_API_TOKEN"),
  },
} as const;
