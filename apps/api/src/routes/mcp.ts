import { Hono } from 'hono';
import { z } from 'zod';
import { getDb, mcpServers, eq } from '@liminal/db';
import { mcpManager } from '@liminal/tools';
import { nanoid } from 'nanoid';

export const mcpRouter = new Hono();

const ServerSchema = z.object({
  name: z.string().min(1),
  command: z.string().min(1),
  args: z.array(z.string()).optional().default([]),
  env: z.record(z.string()).optional(),
});

mcpRouter.get('/servers', (c) => {
  const db = getDb();
  const servers = db.select().from(mcpServers).all();
  const running = mcpManager.list();
  const runningIds = new Set(running.map(r => r.id));
  return c.json(servers.map(s => ({ ...s, connected: runningIds.has(s.id) })));
});

mcpRouter.post('/servers', async (c) => {
  const body = await c.req.json();
  const parsed = ServerSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);

  const { name, command, args, env } = parsed.data;
  const id = nanoid();
  const now = Date.now();

  const db = getDb();
  db.insert(mcpServers).values({
    id, name, command,
    args: JSON.stringify(args),
    env: env ? JSON.stringify(env) : null,
    enabled: 1,
    createdAt: now,
  }).run();

  try {
    await mcpManager.start(id, command, args);
    return c.json({ id, name, command, args, connected: true }, 201);
  } catch (err) {
    return c.json({ id, name, command, args, connected: false, error: String(err) }, 201);
  }
});

mcpRouter.delete('/servers/:id', async (c) => {
  const id = c.req.param('id');
  await mcpManager.stop(id);
  const db = getDb();
  db.delete(mcpServers).where(eq(mcpServers.id, id)).run();
  return c.json({ success: true });
});

mcpRouter.patch('/servers/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const db = getDb();
  const server = db.select().from(mcpServers).where(eq(mcpServers.id, id)).get();
  if (!server) return c.json({ error: 'Not found' }, 404);

  if (typeof body.enabled === 'number') {
    db.update(mcpServers).set({ enabled: body.enabled }).where(eq(mcpServers.id, id)).run();
    if (body.enabled === 0) {
      await mcpManager.stop(id);
    } else {
      const args = server.args ? (JSON.parse(server.args) as string[]) : [];
      try { await mcpManager.start(id, server.command, args); } catch { /* ignore */ }
    }
  }
  return c.json({ success: true });
});
