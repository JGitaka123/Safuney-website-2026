#!/usr/bin/env node
/**
 * Prisma migrate check (CI gate): the migrations folder must fully describe schema.prisma.
 * Fails when someone edits the schema without creating a migration.
 * Needs SHADOW_DATABASE_URL (an empty database Prisma can replay the migrations into).
 *
 * Objects that migration 20260909070000 manages by hand (full-text search column and trigram
 * indexes) are invisible to the Prisma schema, so the diff always proposes dropping them; those
 * statements are the only ones allowed.
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dbDir = resolve(fileURLToPath(new URL("..", import.meta.url)), "packages/db");
const HAND_MANAGED = [/"Product_name_trgm_idx"/, /"Product_searchVector_idx"/, /"ProductVariant_sku_trgm_idx"/, /DROP COLUMN "searchVector"/];

const res = spawnSync(
  "pnpm",
  ["exec", "prisma", "migrate", "diff", "--from-migrations", "prisma/migrations", "--to-schema", "prisma/schema.prisma", "--script"],
  { cwd: dbDir, env: process.env, encoding: "utf8" },
);
if (res.status !== 0) {
  console.error(res.stdout, res.stderr);
  process.exit(res.status ?? 1);
}
const statements = res.stdout
  .split("\n")
  .filter((l) => l.trim() && !l.startsWith("--") && !l.startsWith("Loaded Prisma config") && !l.startsWith("Prisma schema loaded"));
const unexpected = statements.filter((l) => !HAND_MANAGED.some((re) => re.test(l)) && !/^-- This is an empty migration/.test(l));
if (unexpected.length) {
  console.error("migrate-check: schema.prisma differs from the migrations. Create a migration with `pnpm --filter @safuney/db migrate:dev --name <change>`.\n");
  for (const s of unexpected) console.error("  " + s);
  process.exit(1);
}
console.log(`migrate-check: migrations match schema.prisma (${statements.length} hand-managed statement(s) ignored)`);
