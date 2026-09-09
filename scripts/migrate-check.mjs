#!/usr/bin/env node
/**
 * Prisma migrate check (CI gate): the migrations folder must fully describe schema.prisma.
 * Fails when someone edits the schema without creating a migration.
 */
import { execSync } from "node:child_process";
import { resolve } from "node:path";

const dbDir = resolve(new URL("..", import.meta.url).pathname, "packages/db");
const out = execSync(
  "pnpm exec prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --shadow-database-url \"$DATABASE_URL\" --exit-code",
  { cwd: dbDir, env: process.env, stdio: ["ignore", "pipe", "inherit"], shell: "/bin/bash" },
).toString();
console.log(out.trim() || "migrate-check: migrations match schema.prisma");
