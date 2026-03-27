import type { Context, Next } from 'hono';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimiterOptions {
  max: number;       // max requests per window
  window: number;    // window in ms
}

// Track all created stores so the cleanup interval can sweep them
const allStores: Set<Map<string, RateLimitEntry>> = new Set();

// Clean up expired entries every 60s
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const stores of allStores) {
    for (const [key, entry] of stores) {
      if (now > entry.resetAt) stores.delete(key);
    }
  }
}, 60_000);
cleanupTimer.unref();

export function rateLimiter(options: RateLimiterOptions = { max: 100, window: 60_000 }) {
  // Each rateLimiter() call gets its own isolated store
  const store = new Map<string, RateLimitEntry>();
  allStores.add(store);

  return async (c: Context, next: Next) => {
    const ip = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown';
    const now = Date.now();

    let entry = store.get(ip);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + options.window };
      store.set(ip, entry);
    }

    entry.count++;

    c.header('X-RateLimit-Limit', String(options.max));
    c.header('X-RateLimit-Remaining', String(Math.max(0, options.max - entry.count)));
    c.header('X-RateLimit-Reset', String(entry.resetAt));

    if (entry.count > options.max) {
      return c.json(
        { error: 'Too Many Requests', retry_after: Math.ceil((entry.resetAt - now) / 1000) },
        429,
      );
    }

    await next();
  };
}
