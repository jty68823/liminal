/**
 * Integration tests for the cache middleware.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { cacheMiddleware, invalidateCache, getCacheStats } from './cache.js';

function makeApp() {
  const app = new Hono();
  let callCount = 0;

  app.use('/api/v1/models', cacheMiddleware({ ttl: 5000 }));
  app.get('/api/v1/models', (c) => {
    callCount++;
    return c.json({ models: ['deepseek-r1:8b'], callCount });
  });

  return { app, getCallCount: () => callCount };
}

describe('cacheMiddleware', () => {
  beforeEach(() => {
    invalidateCache('api');
  });

  it('returns fresh response on first request (MISS)', async () => {
    const { app } = makeApp();

    const res = await app.request('/api/v1/models');
    expect(res.status).toBe(200);

    const data = await res.json() as { models: string[]; callCount: number };
    expect(data.models).toEqual(['deepseek-r1:8b']);
  });

  it('serves cached response on second request (HIT)', async () => {
    const { app, getCallCount } = makeApp();

    await app.request('/api/v1/models');
    expect(getCallCount()).toBe(1);

    const res2 = await app.request('/api/v1/models');
    expect(res2.headers.get('X-Cache')).toBe('HIT');
    // Handler should NOT have been called again
    expect(getCallCount()).toBe(1);
  });

  it('does not cache POST requests', async () => {
    const { app, getCallCount } = makeApp();

    // GET to warm cache
    await app.request('/api/v1/models');

    // POST should bypass cache
    const postApp = new Hono();
    let postCallCount = 0;
    postApp.use('/api/v1/models', cacheMiddleware({ ttl: 5000 }));
    postApp.post('/api/v1/models', (c) => {
      postCallCount++;
      return c.json({ ok: true });
    });

    await postApp.request('/api/v1/models', { method: 'POST' });
    await postApp.request('/api/v1/models', { method: 'POST' });
    expect(postCallCount).toBe(2);
  });

  it('invalidateCache clears matching entries', async () => {
    const { app, getCallCount } = makeApp();

    await app.request('/api/v1/models');
    expect(getCallCount()).toBe(1);

    invalidateCache('/api/v1/models');

    await app.request('/api/v1/models');
    expect(getCallCount()).toBe(2); // Should have called handler again
  });

  it('getCacheStats returns correct size', async () => {
    const { app } = makeApp();

    await app.request('/api/v1/models');
    const stats = getCacheStats();

    expect(stats.size).toBeGreaterThanOrEqual(1);
  });
});
