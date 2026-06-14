/** Resilient JSON fetch with timeout, exponential backoff, and rate-limit handling. */

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class RateLimitError extends Error {
  constructor(
    public provider: string,
    message = 'Provider rate limit reached',
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export interface FetchOptions {
  retries?: number;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Exponential backoff with jitter, capped at 8s. */
function backoff(attempt: number): number {
  const base = Math.min(8000, 250 * 2 ** attempt);
  return base + Math.floor(Math.random() * 250);
}

/**
 * GET a URL and parse JSON. Retries on network errors, HTTP 429, and 5xx using
 * exponential backoff (honoring `Retry-After` when present). 4xx (except 429)
 * are treated as non-retryable.
 */
export async function fetchJson<T>(url: string, opts: FetchOptions = {}): Promise<T> {
  const retries = opts.retries ?? 3;
  const timeoutMs = opts.timeoutMs ?? 10_000;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers: opts.headers, signal: controller.signal });
      clearTimeout(timer);

      if (res.status === 429 || res.status >= 500) {
        if (attempt < retries) {
          const retryAfter = Number(res.headers.get('retry-after'));
          await sleep(retryAfter > 0 ? retryAfter * 1000 : backoff(attempt));
          continue;
        }
        if (res.status === 429) throw new RateLimitError(new URL(url).hostname);
        throw new HttpError(res.status, `HTTP ${res.status} after ${retries} retries`);
      }

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new HttpError(res.status, `HTTP ${res.status}: ${body.slice(0, 200)}`);
      }

      return (await res.json()) as T;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      // Non-retryable client errors bubble up immediately.
      if (err instanceof HttpError && err.status < 500 && err.status !== 429) throw err;
      if (err instanceof RateLimitError) throw err;
      if (attempt < retries) {
        await sleep(backoff(attempt));
        continue;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('fetch failed');
}
