/*
 * k6 load script — master prompt §10: checkout p95 < 800 ms at 50 concurrent.
 *
 * Run against a PREVIEW, never production:
 *
 *   k6 run -e BASE_URL=https://<preview>.vercel.app load/checkout.js
 *   k6 run -e BASE_URL=... -e VUS=50 -e DURATION=2m load/checkout.js
 *
 * If the preview sits behind Vercel Deployment Protection, pass the bypass secret:
 *   -e BYPASS=<VERCEL_AUTOMATION_BYPASS_SECRET>
 *
 * What it does NOT do: place orders or take payments. It exercises the read path a customer moves
 * through — home, category, product, cart — plus the search endpoint, which is the one that touches
 * Postgres hardest. Loading the write path would fill a preview database with junk orders and consume
 * real stock, and the write path's contention is already covered by the concurrency tests.
 *
 * The thresholds below are the brief's numbers. A Hobby preview is not production hardware: treat a
 * failure here as a signal to look, not as proof the site is slow.
 */
import http from "k6/http";
import { check, group, sleep } from "k6";
import { Trend } from "k6/metrics";

const BASE = __ENV.BASE_URL;
if (!BASE) throw new Error("Set BASE_URL, e.g. -e BASE_URL=https://safuney-website-2026.vercel.app");

const VUS = Number(__ENV.VUS || 50);
const DURATION = __ENV.DURATION || "1m";

const params = {
  headers: __ENV.BYPASS ? { "x-vercel-protection-bypass": __ENV.BYPASS, "x-vercel-set-bypass-cookie": "true" } : {},
};

const journey = new Trend("customer_journey_ms", true);

export const options = {
  scenarios: {
    browse: {
      executor: "constant-vus",
      vus: VUS,
      duration: DURATION,
      gracefulStop: "15s",
    },
  },
  thresholds: {
    // The brief's number, applied to the whole browse-to-cart path a customer actually waits on.
    "http_req_duration{expected_response:true}": ["p(95)<800"],
    customer_journey_ms: ["p(95)<3000"],
    http_req_failed: ["rate<0.01"],
    checks: ["rate>0.99"],
  },
};

/** Pages every customer passes through. Category and product are read from the live catalogue. */
export function setup() {
  const home = http.get(`${BASE}/`, params);
  if (home.status !== 200) throw new Error(`BASE_URL is not serving the site (status ${home.status}). Deployment Protection?`);
  // Find a real product URL rather than hard-coding one that may be unpublished.
  const products = http.get(`${BASE}/products`, params);
  const match = /href="(\/products\/[a-z0-9-]+\/[a-z0-9-]+)"/.exec(products.body);
  return { productPath: match ? match[1] : "/products" };
}

export default function (data) {
  const started = Date.now();

  group("home", () => {
    const r = http.get(`${BASE}/`, params);
    check(r, { "home 200": (x) => x.status === 200 });
  });
  sleep(Math.random() * 2);

  group("catalogue", () => {
    const r = http.get(`${BASE}/products`, params);
    check(r, { "catalogue 200": (x) => x.status === 200 });
  });
  sleep(Math.random() * 2);

  group("product", () => {
    const r = http.get(`${BASE}${data.productPath}`, params);
    check(r, {
      "product 200": (x) => x.status === 200,
      // A product page with no price is a broken page, not a fast one.
      "product shows a price": (x) => /KES|Ksh/i.test(x.body),
    });
  });
  sleep(Math.random());

  group("search", () => {
    // The heaviest read on the site: full-text plus trigram over the catalogue.
    const r = http.get(`${BASE}/search?q=${encodeURIComponent(["sanitiser", "degreaser", "bleach", "detergent"][Math.floor(Math.random() * 4)])}`, params);
    check(r, { "search 200": (x) => x.status === 200 });
  });
  sleep(Math.random());

  group("cart", () => {
    const r = http.get(`${BASE}/cart`, params);
    check(r, { "cart 200": (x) => x.status === 200 });
  });

  journey.add(Date.now() - started);
  sleep(1 + Math.random() * 2);
}
