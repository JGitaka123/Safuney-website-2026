#!/usr/bin/env node
/**
 * Fails the build when the Swahili catalogue is incomplete or has drifted from English.
 *
 * The types already make a missing key a compile error, so what this catches is the subtler failure:
 * a Swahili entry that is still the English string, or an empty one, both of which typecheck and ship
 * a half-translated page. It runs on the source, so it needs no build.
 *
 * The exceptions are real: "VAT", "M-Pesa" and "English" are the same word in both languages, and
 * pretending otherwise would mean translating a brand name.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const file = resolve(root, "apps/web/lib/i18n/messages.ts");
const source = readFileSync(file, "utf8");

/** Keys whose Swahili is legitimately identical to the English. */
const SAME_IN_BOTH = new Set(["cart.vat", "checkout.payMpesa", "common.english", "common.swahili"]);

function block(name) {
  const match = new RegExp(`const ${name}(?::[^=]+)? = \\{([\\s\\S]*?)\\n\\} as const;|const ${name}(?::[^=]+)? = \\{([\\s\\S]*?)\\n\\};`).exec(source);
  if (!match) {
    console.error(`i18n-guard: could not find the "${name}" catalogue in ${file}. Did its shape change?`);
    process.exit(2);
  }
  // Prettier wraps a long value onto its own line; rejoin those so each entry is one line to parse.
  const body = (match[1] ?? match[2]).replace(/":\s*\n\s*"/g, '": "');
  const entries = new Map();
  for (const line of body.split("\n")) {
    const kv = /^\s*"([^"]+)":\s*([\s\S]*?),?\s*$/.exec(line);
    if (!kv) continue;
    entries.set(kv[1], kv[2].trim().replace(/^"/, "").replace(/",?$/, ""));
  }
  return entries;
}

const en = block("en");
const sw = block("sw");
const failures = [];

if (en.size === 0) failures.push("the English catalogue parsed as empty — the guard cannot check anything");

for (const [key, english] of en) {
  const swahili = sw.get(key);
  if (swahili === undefined) {
    failures.push(`${key}: missing from the Swahili catalogue`);
    continue;
  }
  if (swahili.length === 0) {
    failures.push(`${key}: Swahili value is empty`);
    continue;
  }
  if (!SAME_IN_BOTH.has(key) && swahili === english) {
    failures.push(`${key}: Swahili is still the English string ("${english.slice(0, 48)}")`);
  }
}

for (const key of sw.keys()) {
  if (!en.has(key)) failures.push(`${key}: in the Swahili catalogue but not in English — a leftover from a renamed key`);
}

if (failures.length > 0) {
  console.error("\ni18n-guard: FAILED\n");
  for (const f of failures) console.error("  ✗ " + f);
  console.error("");
  process.exit(1);
}
console.log(`i18n-guard: OK — ${en.size} keys, Swahili complete.`);
