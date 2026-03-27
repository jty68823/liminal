import 'dotenv/config';
import { serve } from '@hono/node-server';
import { app } from './app.js';
import { getDb } from '@liminal/db';
import { mcpManager } from '@liminal/tools';

(async () => {
  // Initialize DB (auto-creates tables if not exist)
  getDb();
  console.log('[api] Database ready');

  // Load enabled MCP servers from DB
  await mcpManager.loadFromDb();

  const port = parseInt(process.env['API_PORT'] ?? '3001', 10);
  console.log(`Liminal API starting on port ${port}`);
  const server = serve({ fetch: app.fetch, port });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[api] Port ${port} is already in use. Kill the existing process or set API_PORT to a different value.`);
      process.exit(1);
    }
    throw err;
  });

  process.on('exit', () => { mcpManager.stopAll().catch(() => {}); });
})();
