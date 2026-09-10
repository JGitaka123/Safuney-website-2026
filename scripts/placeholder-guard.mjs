#!/usr/bin/env node
/**
 * Placeholder guard (non-negotiable #6).
 *
 * Fails the build if template/placeholder copy or leaked i18n keys reach the shipped output.
 * Scans:
 *   1. Built output:  apps/web/.next/server/app/**  (html, rsc, txt, body)
 *   2. Source copy:   apps/web/{app,config,content,messages}/** (ts, tsx, md, mdx, json)
 *
 * Usage: node scripts/placeholder-guard.mjs [--source-only]
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const BUILT_DIR = join(ROOT, "apps/web/.next/server/app");
/*
 * Copy that reaches a customer. `packages/db/src` and the discovery seed are here because the
 * catalogue seed IS copy — its `short_description` column becomes the category description a customer
 * reads — and that is exactly where the Phase 0 discovery notes hid for eight phases.
 */
const SOURCE_DIRS = [
  "apps/web/app",
  "apps/web/config",
  "apps/web/content",
  "apps/web/messages",
  "apps/web/lib/content",
  "apps/web/lib/i18n",
  "packages/db/src",
].map((d) => join(ROOT, d));

/*
 * Individual files that are copy even though their folder is not. The catalogue seed's
 * `short_description` column becomes the category description a customer reads; the rest of
 * `docs/discovery/` is a report about the OLD site that legitimately quotes its placeholder text, and
 * scanning the whole folder makes the guard cry wolf about its own evidence.
 */
const SOURCE_FILES = ["docs/discovery/catalogue-seed.csv"].map((f) => join(ROOT, f));

/** Phrases that must never ship. Matched case-insensitively. */
const BANNED_PHRASES = [
  "lorem ipsum",
  "lorem",
  "paragraph of text beneath the heading",
  "here is just a bit more text",
  "dolor sit amet",
  "your text here",
  "insert text here",
  "coming soon",
  "sample text",
  /*
   * Discovery metadata. The Phase 0 catalogue seed carried notes written for me — "Observed category:
   * products.php?a=...", "no products observed on current site" — in the `short_description` column,
   * and every one of them shipped as customer-facing category copy from Phase 2 until Phase 10.
   * Nothing flagged it, because none of it looks like lorem ipsum. It looks like prose.
   */
  "observed category",
  "no products observed",
  "not observed on current site",
  "category from brief",
  "category only —",
  "products.php?",
];

/** Tokens that must not ship in built output (allowed in source comments). */
const BANNED_BUILT_TOKENS = ["TODO", "FIXME", "XXX", "TBD", "PLACEHOLDER"];

/** A text node that is exactly an i18n key such as `nav.home` or `checkout.pay.mpesa`. */
const I18N_KEY = /^[a-z0-9]+(\.[a-zA-Z0-9]+)+$/;
/** Things that legitimately look like keys. */
const I18N_ALLOW = new Set(["safuney.com", "www.safuney.com", "vercel.app", "next.js"]);

const sourceOnly = process.argv.includes("--source-only");

function walk(dir, exts) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full, exts));
    else if (exts.includes(extname(full))) out.push(full);
  }
  return out;
}

function visibleTextChunks(html) {
  // Drop script/style bodies, then split on tags. Cheap and good enough for whole-node key detection.
  const stripped = html.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ");
  return stripped
    .split(/<[^>]+>/)
    .map((s) => s.replace(/&nbsp;/g, " ").trim())
    .filter(Boolean);
}

const failures = [];

function checkPhrases(file, text, extraTokens = []) {
  const lower = text.toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    // Whole-word match so "lorem" does not fire on "valorem".
    const re = new RegExp(`(^|[^a-z])${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`, "i");
    if (re.test(lower)) failures.push(`${relative(ROOT, file)}: banned phrase "${phrase}"`);
  }
  for (const tok of extraTokens) {
    const re = new RegExp(`(^|[^A-Za-z0-9_])${tok}([^A-Za-z0-9_]|$)`);
    if (re.test(text)) failures.push(`${relative(ROOT, file)}: banned token "${tok}"`);
  }
}

function checkI18nLeaks(file, html) {
  for (const chunk of visibleTextChunks(html)) {
    if (chunk.length > 80) continue;
    if (/^[0-9.]+$/.test(chunk)) continue;
    if (I18N_ALLOW.has(chunk.toLowerCase())) continue;
    if (I18N_KEY.test(chunk)) failures.push(`${relative(ROOT, file)}: visible text looks like an untranslated i18n key: "${chunk}"`);
  }
}

// 1. Source copy. `.csv` is in the list because the catalogue seed is copy: its `short_description`
// column becomes the category description a customer reads, and that is exactly where the Phase 0
// discovery notes hid for eight phases.
for (const dir of SOURCE_DIRS) {
  for (const file of walk(dir, [".ts", ".tsx", ".md", ".mdx", ".json", ".csv"])) {
    checkPhrases(file, readFileSync(file, "utf8"));
  }
}
for (const file of SOURCE_FILES) {
  if (existsSync(file)) checkPhrases(file, readFileSync(file, "utf8"));
}

// 2. Built output
if (!sourceOnly) {
  if (!existsSync(BUILT_DIR)) {
    console.error(`placeholder-guard: built output not found at ${relative(ROOT, BUILT_DIR)}. Run \`pnpm build\` first.`);
    process.exit(2);
  }
  const files = walk(BUILT_DIR, [".html", ".rsc", ".txt", ".body"]);
  if (files.length === 0) failures.push("no built pages found under .next/server/app — build output shape changed?");
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    checkPhrases(file, text, BANNED_BUILT_TOKENS);
    if (file.endsWith(".html")) checkI18nLeaks(file, text);
  }
  console.log(`placeholder-guard: scanned ${files.length} built file(s)`);
}

if (failures.length) {
  console.error("\nplaceholder-guard: FAILED\n");
  for (const f of failures) console.error("  ✗ " + f);
  console.error("");
  process.exit(1);
}
console.log("placeholder-guard: OK — no placeholder copy, banned tokens or leaked i18n keys.");
