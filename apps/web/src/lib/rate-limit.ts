import { redis } from './redis';

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
}

/**
 * Fixed-window rate limiter backed by Redis.
 * Fails open: if Redis is unreachable the request is allowed (the limiter is a
 * safety throttle, not an auth gate) so the platform stays usable without Redis.
 */
export async function rateLimit(
  identifier: string,
  max = Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 100),
  windowSeconds = Number(process.env.RATE_LIMIT_WINDOW_SECONDS ?? 60),
): Promise<RateLimitResult> {
  const key = `ratelimit:${identifier}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, windowSeconds);
    const ttl = await redis.ttl(key);
    return {
      success: count <= max,
      remaining: Math.max(0, max - count),
      reset: Date.now() + ttl * 1000,
    };
  } catch (err) {
    console.error('[rate-limit] Redis unavailable, allowing request', err);
    return { success: true, remaining: max, reset: Date.now() + windowSeconds * 1000 };
  }
}
