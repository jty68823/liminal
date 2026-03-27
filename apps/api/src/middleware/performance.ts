/**
 * Performance monitoring middleware for the Liminal API.
 *
 * Tracks request latency, records slow requests, and provides
 * a /health/metrics endpoint for observability.
 */

import type { MiddlewareHandler } from 'hono';
import { createChildLogger } from '../lib/logger.js';

const log = createChildLogger('perf');

interface RequestMetric {
  method: string;
  path: string;
  status: number;
  durationMs: number;
  timestamp: number;
}

// In-memory circular buffer for the last 1000 requests
const BUFFER_SIZE = 1000;
const metrics: RequestMetric[] = [];
let metricsHead = 0;

const SLOW_REQUEST_THRESHOLD_MS = 5000;

function recordMetric(metric: RequestMetric): void {
  metrics[metricsHead % BUFFER_SIZE] = metric;
  metricsHead++;

  if (metric.durationMs > SLOW_REQUEST_THRESHOLD_MS) {
    log.warn(
      { path: metric.path, durationMs: metric.durationMs, status: metric.status },
      'Slow request detected',
    );
  }
}

/**
 * Performance tracking middleware.
 * Attaches X-Request-Time header and records metrics.
 */
export function performanceMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const start = Date.now();
    await next();
    const durationMs = Date.now() - start;

    c.res.headers.set('X-Request-Time', `${durationMs}ms`);

    // Record metric (non-blocking)
    const url = new URL(c.req.url);
    recordMetric({
      method: c.req.method,
      path: url.pathname,
      status: c.res.status,
      durationMs,
      timestamp: start,
    });
  };
}

/**
 * Returns aggregated performance stats for the last N requests.
 */
export function getPerformanceStats(limit = 100): {
  totalRequests: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  slowRequests: number;
  errorRate: number;
  byPath: Record<string, { count: number; avgMs: number }>;
} {
  const count = Math.min(metricsHead, BUFFER_SIZE);
  const start = metricsHead % BUFFER_SIZE;
  const ordered = metricsHead > BUFFER_SIZE
    ? [...metrics.slice(start, BUFFER_SIZE), ...metrics.slice(0, start)].filter(Boolean)
    : metrics.slice(0, count).filter(Boolean);
  const recent = ordered.slice(-limit);

  if (recent.length === 0) {
    return {
      totalRequests: 0,
      avgLatencyMs: 0,
      p95LatencyMs: 0,
      p99LatencyMs: 0,
      slowRequests: 0,
      errorRate: 0,
      byPath: {},
    };
  }

  const durations = recent.map((m) => m.durationMs).sort((a, b) => a - b);
  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
  const p95 = durations[Math.floor(durations.length * 0.95)] ?? 0;
  const p99 = durations[Math.floor(durations.length * 0.99)] ?? 0;
  const slow = recent.filter((m) => m.durationMs > SLOW_REQUEST_THRESHOLD_MS).length;
  const errors = recent.filter((m) => m.status >= 500).length;

  const byPath: Record<string, { count: number; totalMs: number; avgMs: number }> = {};
  for (const m of recent) {
    if (!byPath[m.path]) byPath[m.path] = { count: 0, totalMs: 0, avgMs: 0 };
    byPath[m.path].count++;
    byPath[m.path].totalMs += m.durationMs;
  }
  for (const [path, stat] of Object.entries(byPath)) {
    stat.avgMs = Math.round(stat.totalMs / stat.count);
    byPath[path] = { count: stat.count, avgMs: stat.avgMs } as typeof stat;
  }

  return {
    totalRequests: metricsHead,
    avgLatencyMs: Math.round(avg),
    p95LatencyMs: p95,
    p99LatencyMs: p99,
    slowRequests: slow,
    errorRate: errors / recent.length,
    byPath: byPath as Record<string, { count: number; avgMs: number }>,
  };
}
