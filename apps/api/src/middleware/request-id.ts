import type { Context, Next } from 'hono';
import { randomUUID } from 'crypto';

export function requestId() {
  return async (c: Context, next: Next) => {
    const id = c.req.header('x-request-id') ?? randomUUID();
    c.set('requestId', id);
    c.header('X-Request-Id', id);
    await next();
  };
}
