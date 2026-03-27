import type { Context, Next } from 'hono';

let counter = 0;

export function requestId() {
  return async (c: Context, next: Next) => {
    const id = c.req.header('x-request-id') ?? `req_${Date.now()}_${counter++}`;
    c.set('requestId', id);
    c.header('X-Request-Id', id);
    await next();
  };
}
