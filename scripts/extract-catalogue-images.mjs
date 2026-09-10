/**
 * Cuts the product photography out of Safuney's own PDF catalogue and writes it into
 * apps/web/public/products, one WebP per product, plus a manifest the seed reads.
 *
 * The catalogue embeds each pack shot as a JPEG with a separate soft mask, so the packs come out as
 * true cut-outs on transparency rather than as photographs of a white rectangle. That matters on a
 * product grid, where a white box inside a white card shows its edges.
 *
 * The source PDF is not in the repository (it is a 1.4 MB binary the PO supplied), so this script
 * takes its path as an argument and exists to make the provenance of the committed images auditable
 * rather than to run in CI:
 *
 *   pnpm exec node scripts/extract-catalogue-images.mjs /path/to/PRODUCT_CATALOGUE_JULY_2024.pdf
 *
 * Requires poppler-utils (pdfimages) on PATH. Which image belongs to which product is recorded in
 * the image_source column of docs/discovery/catalogue-seed.csv: "p04-n012" is page 4, image 12, in
 * the page's own content-stream order (which is not reading order — the mapping was made by eye).
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CSV = join(ROOT, "docs/discovery/catalogue-seed.csv");
const OUT_DIR = join(ROOT, "apps/web/public/products");
/** Flattened JPEG twins for the share cards: Satori cannot decode WebP or composite transparency. */
const OG_DIR = join(OUT_DIR, "og");
const MANIFEST = join(ROOT, "docs/discovery/catalogue-images.json");

/**
 * Longest edge of a written image.
 *
 * The catalogue's own bitmaps are only 90-190 px across, which is a stamp on a product page. Shown at
 * their own size they are sharp and tiny; stretched by the browser they are mush. So they are
 * resampled once here, with Lanczos, and the page then never scales them up again — these are smooth
 * studio pack shots, and a good resample of one reads as a photograph where a browser's upscale of
 * the same pixels reads as a mistake. It adds no detail that was not there; it only moves the
 * softening to where it can be done well.
 */
const EDGE = 480;

const pdf = process.argv[2];
if (!pdf) {
  console.error("usage: node scripts/extract-catalogue-images.mjs <catalogue.pdf>");
  process.exit(2);
}

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') (cur += '"'), i++;
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") (out.push(cur), (cur = ""));
    else cur += ch;
  }
  out.push(cur);
  return out;
}

const lines = readFileSync(CSV, "utf8").replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim());
const header = splitCsvLine(lines[0]);
const rows = lines.slice(1).map((l) => Object.fromEntries(splitCsvLine(l).map((c, i) => [header[i], c])));

/** product slug -> { source, alt } ; first row of each product wins. */
const wanted = new Map();
for (const r of rows) {
  if (!r.product_slug || !r.image_source || wanted.has(r.product_slug)) continue;
  wanted.set(r.product_slug, { source: r.image_source, name: r.product_name });
}

const work = mkdtempSync(join(tmpdir(), "sfn-cat-"));
try {
  const list = execFileSync("pdfimages", ["-list", pdf], { encoding: "utf8", maxBuffer: 1 << 24 });
  execFileSync("pdfimages", ["-all", pdf, join(work, "i")], { maxBuffer: 1 << 24 });

  const entries = list
    .split("\n")
    .slice(2)
    .map((l) => l.trim().split(/\s+/))
    .filter((p) => p.length > 5)
    .map((p) => ({ page: +p[0], num: +p[1], type: p[2], w: +p[3], h: +p[4] }));

  const files = new Map();
  for (const f of readdirSync(work)) {
    const m = /^i-(\d+)\.\w+$/.exec(f);
    if (m) files.set(+m[1], join(work, f));
  }

  const byId = new Map();
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.type !== "image" || !files.has(e.num)) continue;
    const id = `p${String(e.page).padStart(2, "0")}-n${String(e.num).padStart(3, "0")}`;
    const next = entries[i + 1];
    byId.set(id, { ...e, mask: next && next.type === "smask" && next.w === e.w && next.h === e.h ? files.get(next.num) : null, file: files.get(e.num) });
  }

  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(OG_DIR, { recursive: true });
  const manifest = {};
  for (const [slug, { source, name }] of [...wanted].sort()) {
    const e = byId.get(source);
    if (!e) throw new Error(`${slug}: no image ${source} in ${pdf}`);
    let img;
    if (e.mask) {
      // pdfimages writes the soft mask as its own greyscale file; sharp re-joins it as the alpha.
      const rgb = await sharp(e.file).resize(e.w, e.h, { fit: "fill" }).removeAlpha().toColourspace("srgb").raw().toBuffer();
      const alpha = await sharp(e.mask).resize(e.w, e.h, { fit: "fill" }).greyscale().raw().toBuffer();
      img = sharp(rgb, { raw: { width: e.w, height: e.h, channels: 3 } }).joinChannel(alpha, { raw: { width: e.w, height: e.h, channels: 1 } });
    } else {
      img = sharp(e.file).ensureAlpha();
    }
    // Round-trip through PNG: trim() needs a decodable input, and the masked branch is raw pixels.
    const flat = await img.png().toBuffer();
    const trimmed = await sharp(flat).trim({ threshold: 6 }).png().toBuffer();
    const out = await sharp(trimmed)
      .resize({ width: EDGE, height: EDGE, fit: "inside", kernel: "lanczos3" })
      .webp({ quality: 82, alphaQuality: 100, effort: 6 })
      .toBuffer({ resolveWithObject: true });
    writeFileSync(join(OUT_DIR, `${slug}.webp`), out.data);
    const og = await sharp(trimmed).resize({ height: 320, fit: "inside", kernel: "lanczos3" }).flatten({ background: "#ffffff" }).jpeg({ quality: 78, progressive: true }).toBuffer();
    writeFileSync(join(OG_DIR, `${slug}.jpg`), og);
    manifest[slug] = { url: `/products/${slug}.webp`, width: out.info.width, height: out.info.height, alt: `${name} pack`, source };
  }
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`wrote ${Object.keys(manifest).length} images to ${OUT_DIR}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
