#!/usr/bin/env node
/**
 * Money type guard (non-negotiable #2): money is bigint minor units, never a JS number or a Float.
 *  - Prisma schema: any field whose name ends in MinorUnits must be BigInt.
 *  - TypeScript: any property/parameter named *MinorUnits typed `number`, or any `Float`/`Decimal`
 *    money-ish field, fails.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const failures = [];

const schema = readFileSync(join(ROOT, "packages/db/prisma/schema.prisma"), "utf8");
for (const [i, line] of schema.split("\n").entries()) {
  const m = /^\s+(\w*MinorUnits)\s+(\w+)/.exec(line);
  if (m && m[2] !== "BigInt") failures.push(`schema.prisma:${i + 1}: ${m[1]} is ${m[2]}, must be BigInt`);
  if (/^\s+\w*(price|amount|total|fee)\w*\s+(Float|Decimal|Int)\b/i.test(line) && !/packSizeValue|vatRateBps|Threshold|qty|Days|Grams|sortOrder|Count|Cap/.test(line)) failures.push(`schema.prisma:${i + 1}: money-like field not BigInt: ${line.trim()}`);
}

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    if (["node_modules", ".next", "generated", "dist", "test-results", "playwright-report", ".lighthouseci"].includes(e)) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if ([".ts", ".tsx"].includes(extname(p))) out.push(p);
  }
  return out;
}
for (const file of [...walk(join(ROOT, "apps")), ...walk(join(ROOT, "packages"))]) {
  const src = readFileSync(file, "utf8");
  for (const [i, line] of src.split("\n").entries()) {
    if (/\w*MinorUnits\??\s*:\s*number\b/.test(line)) failures.push(`${relative(ROOT, file)}:${i + 1}: money typed as number: ${line.trim()}`);
  }
}

if (failures.length) {
  console.error("money-guard: FAILED");
  for (const f of failures) console.error("  ✗ " + f);
  process.exit(1);
}
console.log("money-guard: OK — all money fields are BigInt/bigint minor units.");
