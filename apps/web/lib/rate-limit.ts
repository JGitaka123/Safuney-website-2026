/**
 * Rate limiting for public write paths (contact form).
 *
 * Uses Upstash Ratelimit over Upstash Redis when Redis is configured; otherwise an in-memory sliding
 * window that is good enough for a single instance (local dev, preview builds). Keys are IP addresses
 * or another caller-supplied identifier; nothing else is stored.
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { config, services } from "./env";

export interface RateLimitResult {
  /** True when the request may proceed. */
  ok: boolean;
  /** Seconds until the caller may try again. 0 when ok. */
  retryAfterSeconds: number;
}

export interface RateLimiter {
  limit(key: string): Promise<RateLimitResult>;
}

export interface MemoryRateLimiterOptions {
  /** Requests allowed per window. */
  max: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Clock, injectable for tests. Defaults to Date.now. */
  now?: () => number;
}

/** Contact form policy: 5 requests per 10 minutes per key. */
export const LEAD_RATE_LIMIT = { max: 5, windowMs: 10 * 60 * 1000 } as const;

/**
 * Sliding-window limiter held in process memory. Timestamps older than the window are dropped on each
 * call, so memory stays bounded by (keys x max).
 */
export function createMemoryRateLimiter(options: MemoryRateLimiterOptions): RateLimiter {
  const now = options.now ?? (() => Date.now());
  const hits = new Map<string, number[]>();
  return {
    async limit(key) {
      const t = now();
      const windowStart = t - options.windowMs;
      const recent = (hits.get(key) ?? []).filter((stamp) => stamp > windowStart);
      if (recent.length >= options.max) {
        hits.set(key, recent);
        const oldest = recent[0] ?? t;
        return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((oldest + options.windowMs - t) / 1000)) };
      }
      recent.push(t);
      hits.set(key, recent);
      return { ok: true, retryAfterSeconds: 0 };
    },
  };
}

function createUpstashRateLimiter(): RateLimiter {
  const redis = new Redis({ url: config.redis.url!, token: config.redis.token! });
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(LEAD_RATE_LIMIT.max, "10 m"),
    prefix: "safuney:leads",
  });
  return {
    async limit(key) {
      const result = await limiter.limit(key);
      if (result.success) return { ok: true, retryAfterSeconds: 0 };
      return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)) };
    },
  };
}

const globalForLimiter = globalThis as unknown as { __safuneyLeadLimiter?: RateLimiter };

/** Limiter for the contact form. One instance per process; survives dev hot reloads. */
export function getLeadRateLimiter(): RateLimiter {
  if (!globalForLimiter.__safuneyLeadLimiter) {
    globalForLimiter.__safuneyLeadLimiter = services.redis()
      ? createUpstashRateLimiter()
      : createMemoryRateLimiter(LEAD_RATE_LIMIT);
  }
  return globalForLimiter.__safuneyLeadLimiter;
}
