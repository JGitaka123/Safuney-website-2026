#!/usr/bin/env node
/**
 * Runs before `next build` (apps/web "prebuild" script), locally, in CI and on Vercel.
 *  1. Always: generate the Prisma client (the generated folder is git-ignored).
 *  2. When DATABASE_URL is set: apply pending migrations with `prisma migrate deploy`.
 *     This is the only way migrations reach production (never by hand).
 * Never prints secrets.
 */
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dbDir = resolve(fileURLToPath(new URL("..", import.meta.url)), "packages/db");
const run = (cmd) => execSync(cmd, { cwd: dbDir, stdio: "inherit", env: process.env });

console.log("prebuild: prisma generate");
run("pnpm exec prisma generate");

if (process.env.DATABASE_URL) {
  if (process.env.SKIP_MIGRATE === "1") {
    console.log("prebuild: SKIP_MIGRATE=1, not running migrations");
  } else {
    console.log("prebuild: prisma migrate deploy");
    run("pnpm exec prisma migrate deploy");
  }
} else {
  console.log("prebuild: DATABASE_URL not set — skipping migrations. Database-backed features will be disabled at runtime.");
}
