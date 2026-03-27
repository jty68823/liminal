import 'dotenv/config';
import { serve } from '@hono/node-server';
import { app } from './app.js';
import { getDb } from '@liminal/db';
import { mcpManager } from '@liminal/tools';
import { attachWebSocketHandler } from './routes/dispatch-ws.js';
import { logger } from './lib/logger.js';

const log = logger.child({ module: 'server' });

(async () => {
  // Initialize DB (auto-creates tables if not exist)
  getDb();
  log.info('Database ready');

  const port = parseInt(process.env['API_PORT'] ?? '3001', 10);
  log.info({ port }, 'Liminal API starting');
  const server = serve({ fetch: app.fetch, port });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      log.fatal({ port }, 'Port already in use');
      process.exit(1);
    }
    throw err;
  });

  // Attach WebSocket handler for dispatch real-time events
  attachWebSocketHandler(server);

  // Load MCP servers in the background — don't block API startup
  mcpManager.loadFromDb().then(() => {
    log.info('MCP servers loaded');
  }).catch((err) => {
    log.warn({ err }, 'MCP server loading error (non-fatal)');
  });

  // ── Graceful shutdown ──────────────────────────────────────────────────
  let isShuttingDown = false;

  async function gracefulShutdown(signal: string): Promise<void> {
    if (isShuttingDown) return;
    isShuttingDown = true;
    log.info({ signal }, 'Graceful shutdown initiated');

    const DRAIN_TIMEOUT = 10_000; // 10 seconds to drain

    const timer = setTimeout(() => {
      log.warn('Shutdown drain timeout exceeded, forcing exit');
      process.exit(1);
    }, DRAIN_TIMEOUT);

    try {
      // 1. Stop accepting new connections
      server.close();

      // 2. Stop MCP servers
      await mcpManager.stopAll().catch((err) => {
        log.warn({ err }, 'Error stopping MCP servers during shutdown');
      });

      // 3. Close browser if it was opened
      try {
        const tools = await import('@liminal/tools');
        // @ts-expect-error optional module
        if (tools.browserManager?.close) await tools.browserManager.close();
      } catch { /* best-effort */ }

      log.info('Shutdown complete');
      clearTimeout(timer);
      process.exit(0);
    } catch (err) {
      log.error({ err }, 'Error during shutdown');
      clearTimeout(timer);
      process.exit(1);
    }
  }

  process.on('SIGTERM', () => { void gracefulShutdown('SIGTERM'); });
  process.on('SIGINT', () => { void gracefulShutdown('SIGINT'); });

  // Catch unhandled rejections
  process.on('unhandledRejection', (reason) => {
    log.error({ err: reason }, 'Unhandled rejection');
  });

  process.on('uncaughtException', (err) => {
    log.fatal({ err }, 'Uncaught exception');
    process.exit(1);
  });
})();
