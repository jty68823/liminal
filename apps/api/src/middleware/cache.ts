/**
 * Response cache middleware for the Liminal API.
 *
 * Caches GET endpoint responses in memory with TTL.
 * Useful for: /api/v1/models, /api/v1/tools, /api/v1/settings
 *
 * Does NOT cache POST/PUT/DELETE or streaming endpoints.
 */

import type { MiddlewareHandler } from 'hono';

interface CacheEntry {
  body: string;
  contentType: string;
  status: number;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

// Clean up expired entries every 5 minutes
// unref() prevents this timer from keeping the Node process alive
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt <= now) {
      cache.delete(key);
    }
  }
}, 5 * 60 * 1000);
cleanupTimer.unref();

export interface CacheOptions {
  /** TTL in milliseconds. Default: 30 seconds. */
  ttl?: number;
  /** Key prefix for namespacing. Default: 'api'. */
  prefix?: string;
}

/**
 * Creates a cache middleware for GET requests.
 *
 * Usage:
 * ```ts
 * app.use('/api/v1/models', cacheMiddleware({ ttl: 60_000 }));
 * ```
 */
export function cacheMiddleware(options: CacheOptions = {}): MiddlewareHandler {
  const { ttl = 30_000, prefix = 'api' } = options;

  return async (c, next) => {
    // Only cache GET requests
    if (c.req.method !== 'GET') {
      return next();
    }

    const key = `${prefix}:${c.req.url}`;
    const now = Date.now();

    // Check cache
    const cached = cache.get(key);
    if (cached && cached.expiresAt > now) {
      return c.newResponse(cached.body, cached.status as 200, {
        'Content-Type': cached.contentType,
        'X-Cache': 'HIT',
        'X-Cache-TTL': String(Math.ceil((cached.expiresAt - now) / 1000)),
      });
    }

    // Process request
    await next();

    // Cache successful JSON responses
    if (c.res.status === 200) {
      const contentType = c.res.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        try {
          const body = await c.res.clone().text();
          cache.set(key, {
            body,
            contentType,
            status: c.res.status,
            expiresAt: now + ttl,
          });
          c.res.headers.set('X-Cache', 'MISS');
        } catch {
          // Caching failed — not fatal
        }
      }
    }
  };
}

/**
 * Invalidate all cache entries matching a prefix pattern.
 */
export function invalidateCache(pattern: string): void {
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
    }
  }
}

/**
 * Get cache statistics.
 */
export function getCacheStats(): { size: number; entries: Array<{ key: string; expiresIn: number }> } {
  const now = Date.now();
  const entries = Array.from(cache.entries()).map(([key, entry]) => ({
    key,
    expiresIn: Math.max(0, entry.expiresAt - now),
  }));
  return { size: cache.size, entries };
}
