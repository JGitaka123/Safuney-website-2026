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

function smtpConfigured(): boolean {
  return has("SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD");
}

export const services = {
  database: () => has("DATABASE_URL"),
  /** Email goes through the site's own mail server (SMTP, e.g. the cPanel mailbox) or Resend. */
  email: () => smtpConfigured() || has("RESEND_API_KEY"),
  redis: () => has("UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN") || has("KV_REST_API_URL", "KV_REST_API_TOKEN"),
  /**
   * Somewhere for an enquiry to go: stored in the database, emailed to the leads inbox, or both
   * (lib/leads.ts). Without either, forms hand the enquiry to WhatsApp instead of failing.
   */
  leads: () => has("DATABASE_URL") || smtpConfigured() || has("RESEND_API_KEY"),
} as const;

export const config = {
  /**
   * Sender address. With SMTP it defaults to the mailbox being signed in to, since the mail server may
   * refuse to send as anyone else; with Resend it must be on the verified domain.
   */
  emailFrom: read("EMAIL_FROM") ?? (read("SMTP_USER") ? `Safuney <${read("SMTP_USER")}>` : "Safuney website <no-reply@safuney.com>"),
  /** Where contact-form leads are emailed. */
  leadsInbox: read("LEADS_INBOX") ?? "info@safuney.com",
  siteUrl: read("NEXT_PUBLIC_SITE_URL") ?? (read("VERCEL_URL") ? `https://${read("VERCEL_URL")}` : "http://localhost:3000"),
  isProduction: read("VERCEL_ENV") === "production",
  /**
   * Outgoing mail server. Port 465 is implicit TLS; 587 upgrades with STARTTLS. Preferred over Resend
   * when both are set, because it is the server the domain's SPF and DKIM already vouch for.
   */
  smtp: {
    host: read("SMTP_HOST"),
    port: Number(read("SMTP_PORT") ?? 465),
    user: read("SMTP_USER"),
    password: read("SMTP_PASSWORD"),
  },
  redis: {
    url: read("UPSTASH_REDIS_REST_URL") ?? read("KV_REST_API_URL"),
    token: read("UPSTASH_REDIS_REST_TOKEN") ?? read("KV_REST_API_TOKEN"),
  },
} as const;
