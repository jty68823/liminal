/**
 * Bearer token auth middleware for dispatch routes.
 * Reads DISPATCH_AUTH_TOKEN from env. If unset, all dispatch routes return 403.
 */

import { createMiddleware } from 'hono/factory';

export const dispatchAuth = createMiddleware(async (c, next) => {
  const token = process.env['DISPATCH_AUTH_TOKEN'];

  if (!token) {
    return c.json({ error: 'Dispatch API disabled. Set DISPATCH_AUTH_TOKEN env var.' }, 403);
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader) {
    return c.json({ error: 'Missing Authorization header' }, 401);
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return c.json({ error: 'Invalid Authorization format. Expected: Bearer <token>' }, 401);
  }

  if (parts[1] !== token) {
    return c.json({ error: 'Invalid token' }, 401);
  }

  await next();
});
