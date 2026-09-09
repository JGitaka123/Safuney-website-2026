import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LEAD_RATE_LIMIT, createMemoryRateLimiter } from "@/lib/rate-limit";

describe("in-memory sliding window rate limiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-09T09:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows five requests in ten minutes and blocks the sixth", async () => {
    const limiter = createMemoryRateLimiter(LEAD_RATE_LIMIT);
    for (let i = 0; i < 5; i++) {
      const r = await limiter.limit("203.0.113.5");
      expect(r.ok, `request ${i + 1}`).toBe(true);
      vi.advanceTimersByTime(60_000);
    }
    const sixth = await limiter.limit("203.0.113.5");
    expect(sixth.ok).toBe(false);
    // First hit was 5 minutes ago, so the window frees up in 5 minutes.
    expect(sixth.retryAfterSeconds).toBe(300);
  });

  it("keys are independent", async () => {
    const limiter = createMemoryRateLimiter(LEAD_RATE_LIMIT);
    for (let i = 0; i < 5; i++) await limiter.limit("a");
    expect((await limiter.limit("a")).ok).toBe(false);
    expect((await limiter.limit("b")).ok).toBe(true);
  });

  it("resets once the window has passed", async () => {
    const limiter = createMemoryRateLimiter(LEAD_RATE_LIMIT);
    for (let i = 0; i < 5; i++) await limiter.limit("203.0.113.5");
    expect((await limiter.limit("203.0.113.5")).ok).toBe(false);

    vi.advanceTimersByTime(LEAD_RATE_LIMIT.windowMs + 1);
    const again = await limiter.limit("203.0.113.5");
    expect(again).toEqual({ ok: true, retryAfterSeconds: 0 });
  });

  it("slides rather than resetting in fixed buckets", async () => {
    const limiter = createMemoryRateLimiter({ max: 2, windowMs: 10_000 });
    expect((await limiter.limit("k")).ok).toBe(true); // t=0
    vi.advanceTimersByTime(6_000);
    expect((await limiter.limit("k")).ok).toBe(true); // t=6
    expect((await limiter.limit("k")).ok).toBe(false); // t=6, two in window
    vi.advanceTimersByTime(4_001); // t=10.001: the t=0 hit has expired, the t=6 hit has not
    expect((await limiter.limit("k")).ok).toBe(true);
    expect((await limiter.limit("k")).ok).toBe(false);
  });
});
