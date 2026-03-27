/**
 * Dispatch REST routes — remote command execution API.
 *
 * POST   /dispatch           — Create a new dispatch task
 * GET    /dispatch            — List dispatch tasks
 * GET    /dispatch/:id        — Get task details
 * DELETE /dispatch/:id        — Cancel/delete task
 * POST   /dispatch/wake       — Wake-on-LAN trigger
 * GET    /dispatch/pc-status  — Check PC health
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { dispatchAuth } from '../middleware/dispatch-auth.js';
import { dispatchTask, cancelDispatchTask } from '../services/dispatch.service.js';
import {
  getDispatchTask,
  listDispatchTasks,
  deleteDispatchTask,
  getDispatchEvents,
} from '@liminal/db';

export const dispatchRouter = new Hono();

// Apply auth middleware to all dispatch routes
dispatchRouter.use('*', dispatchAuth);

// ---------------------------------------------------------------------------
// POST /dispatch — create a new task
// ---------------------------------------------------------------------------

const CreateTaskSchema = z.object({
  instruction: z.string().min(1, 'Instruction cannot be empty'),
  source: z.string().optional(),
  model: z.string().optional(),
});

dispatchRouter.post('/', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const parsed = CreateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const task = dispatchTask(parsed.data);
  return c.json({ task }, 201);
});

// ---------------------------------------------------------------------------
// GET /dispatch — list tasks
// ---------------------------------------------------------------------------

dispatchRouter.get('/', (c) => {
  const limit = parseInt(c.req.query('limit') ?? '50', 10);
  const tasks = listDispatchTasks(limit);
  return c.json({ tasks });
});

// ---------------------------------------------------------------------------
// GET /dispatch/:id — get task details + events
// ---------------------------------------------------------------------------

dispatchRouter.get('/:id', (c) => {
  const id = c.req.param('id');
  const task = getDispatchTask(id);
  if (!task) return c.json({ error: 'Task not found' }, 404);

  const events = getDispatchEvents(id);
  return c.json({ task, events });
});

// ---------------------------------------------------------------------------
// DELETE /dispatch/:id — cancel or delete task
// ---------------------------------------------------------------------------

dispatchRouter.delete('/:id', (c) => {
  const id = c.req.param('id');
  const task = getDispatchTask(id);
  if (!task) return c.json({ error: 'Task not found' }, 404);

  if (task.status === 'running') {
    cancelDispatchTask(id);
    return c.json({ message: 'Task cancelled' });
  }

  deleteDispatchTask(id);
  return c.json({ message: 'Task deleted' });
});

// ---------------------------------------------------------------------------
// POST /dispatch/wake — Wake-on-LAN
// ---------------------------------------------------------------------------

dispatchRouter.post('/wake', async (c) => {
  const wolProxyUrl = process.env['WOL_PROXY_URL'];
  if (!wolProxyUrl) {
    return c.json({ error: 'WOL_PROXY_URL not configured' }, 503);
  }

  try {
    const res = await fetch(`${wolProxyUrl}/wake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mac: process.env['PC_MAC_ADDRESS'] ?? '',
      }),
    });
    const data = await res.json();
    return c.json(data, res.ok ? 200 : 502);
  } catch (err) {
    return c.json({ error: `WoL proxy unreachable: ${err instanceof Error ? err.message : String(err)}` }, 502);
  }
});

// ---------------------------------------------------------------------------
// GET /dispatch/pc-status — health check
// ---------------------------------------------------------------------------

dispatchRouter.get('/pc-status', async (c) => {
  const wolProxyUrl = process.env['WOL_PROXY_URL'];
  if (!wolProxyUrl) {
    // If no WoL proxy, check if we're alive (we obviously are)
    return c.json({ status: 'awake', message: 'API is running' });
  }

  try {
    const res = await fetch(`${wolProxyUrl}/status`, { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    return c.json(data);
  } catch {
    return c.json({ status: 'unknown', message: 'Could not reach WoL proxy' }, 502);
  }
});
