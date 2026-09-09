# Load testing

`checkout.js` is the k6 script the brief asks for: **checkout p95 < 800 ms at 50 concurrent**.

## Running it

```bash
# Install k6: https://k6.io/docs/get-started/installation/
k6 run -e BASE_URL=https://<your-preview>.vercel.app load/checkout.js

# The brief's target
k6 run -e BASE_URL=https://<preview>.vercel.app -e VUS=50 -e DURATION=2m load/checkout.js

# If the preview is behind Deployment Protection
k6 run -e BASE_URL=... -e BYPASS=$VERCEL_AUTOMATION_BYPASS_SECRET load/checkout.js
```

## What it exercises, and what it deliberately does not

It walks the read path a customer moves through — home, catalogue, product, search, cart — with realistic
pauses between steps. Search is included because it is the query that touches Postgres hardest.

**It does not place orders or take payments.** Loading the write path would fill a preview database with
junk orders, consume real reserved stock, and hit the payment provider's sandbox rate limits. The write
path's actual risk is contention, not throughput, and that is covered by the concurrency tests in
`apps/web/test/` — which race four concurrent orders for the last packs and assert stock never goes
negative.

## Reading the result

- `http_req_duration p(95)` is the brief's number.
- `customer_journey_ms` is the whole sequence per virtual user, which is what a person experiences.
- `http_req_failed` should be effectively zero. Anything else means errors under load, which matters
  more than latency.

**A Hobby-plan preview is not production hardware**, and it cold-starts. Run it twice and use the second
result. If p95 misses on a preview, look at *which* request is slow before concluding the site is slow —
it is usually the first request to a cold function.

## Not run in CI
On purpose. A load test in CI is a flaky test that fails on a busy runner and teaches everyone to ignore
red. Run it before launch, and again after any change to the catalogue queries.
