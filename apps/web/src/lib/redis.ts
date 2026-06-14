import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as { redis: Redis | undefined };

export const redis =
  globalForRedis.redis ??
  new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;

/**
 * Cache helper with JSON serialization + TTL.
 * Fails open: if Redis is unreachable the value is computed directly so the
 * request still succeeds (caching is an optimization, not a hard dependency).
 */
export async function cached<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  try {
    const hit = await redis.get(key);
    if (hit) return JSON.parse(hit) as T;
  } catch (err) {
    console.error('[redis] get failed, bypassing cache', err);
    return fn();
  }
  const value = await fn();
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    console.error('[redis] set failed, returning uncached value', err);
  }
  return value;
}
