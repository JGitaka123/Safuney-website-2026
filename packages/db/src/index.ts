import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/client/client";

export * from "../generated/client/client";
export * as money from "./money";

/** True when a database connection string is configured for this process. */
export function isDatabaseConfigured(): boolean {
  return typeof process.env["DATABASE_URL"] === "string" && process.env["DATABASE_URL"].length > 0;
}

function createClient(): PrismaClient {
  const url = process.env["DATABASE_URL"];
  if (!url) {
    throw new Error("DATABASE_URL is not set. Pull it with `vercel env pull apps/web/.env.local` or set it in the shell.");
  }
  const adapter = new PrismaPg({ connectionString: url, max: Number(process.env["DATABASE_POOL_MAX"] ?? 5) });
  return new PrismaClient({
    adapter,
    log: process.env["NODE_ENV"] === "development" ? ["warn", "error"] : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as { __safuneyPrisma?: PrismaClient };

/** Lazily-created singleton (survives Next.js dev hot reloads). Throws if DATABASE_URL is unset. */
export function db(): PrismaClient {
  if (!globalForPrisma.__safuneyPrisma) globalForPrisma.__safuneyPrisma = createClient();
  return globalForPrisma.__safuneyPrisma;
}

/** For tests: create a fresh client bound to a specific URL. Caller must disconnect. */
export function createTestClient(url: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 2 }) });
}
