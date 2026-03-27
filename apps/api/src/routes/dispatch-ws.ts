/**
 * WebSocket upgrade handler for dispatch real-time events.
 * Route: GET /api/v1/dispatch/ws
 *
 * Protocol:
 *   Client → Server:  { type: "subscribe", taskId: "..." }
 *                      { type: "unsubscribe", taskId: "..." }
 *                      { type: "ping" }
 *   Server → Client:  { type: "task_created|task_progress|task_token|task_screenshot|task_complete|task_error|pong", ... }
 */

import { Hono } from 'hono';
import { wsManager } from '../lib/ws-manager.js';

export const dispatchWsRouter = new Hono();

/**
 * WebSocket upgrade endpoint.
 * Since Hono's @hono/node-ws may not be available, we provide a
 * standards-based upgrade handler that works with the Node.js HTTP server.
 */
dispatchWsRouter.get('/ws', async (c) => {
  // Check for auth token in query param (WebSocket can't send custom headers)
  const token = c.req.query('token');
  const expectedToken = process.env['DISPATCH_AUTH_TOKEN'];

  if (expectedToken && token !== expectedToken) {
    return c.json({ error: 'Invalid or missing token query param' }, 401);
  }

  // If the runtime supports WebSocket upgrade natively (Bun, Deno)
  const upgradeHeader = c.req.header('upgrade');
  if (upgradeHeader?.toLowerCase() !== 'websocket') {
    return c.json({
      error: 'WebSocket upgrade required',
      note: 'Connect via ws://host:port/api/v1/dispatch/ws?token=YOUR_TOKEN',
    }, 426);
  }

  // For non-native WS environments, return instructions
  return c.json({
    message: 'WebSocket endpoint active. Use the standalone WS server or native runtime.',
    wsUrl: '/api/v1/dispatch/ws',
  });
});

/**
 * Attach WebSocket handling to a raw Node.js HTTP server.
 * Call this from the server setup to enable WS support.
 */
export function attachWebSocketHandler(server: import('http').Server): void {
  try {
    // Dynamic import to avoid hard dependency
    const WebSocket = require('ws');
    const wss = new WebSocket.Server({ noServer: true });

    server.on('upgrade', (req: import('http').IncomingMessage, socket: import('stream').Duplex, head: Buffer) => {
      const url = new URL(req.url ?? '', `http://${req.headers.host}`);

      if (url.pathname !== '/api/v1/dispatch/ws') {
        socket.destroy();
        return;
      }

      // Auth check via query param
      const token = url.searchParams.get('token');
      const expectedToken = process.env['DISPATCH_AUTH_TOKEN'];
      if (expectedToken && token !== expectedToken) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (ws: unknown) => {
        const wsConn = ws as { on(event: string, cb: (data: unknown) => void): void; send(data: string): void; readyState: number };
        const clientId = wsManager.addClient(wsConn);

        wsConn.on('message', (data: unknown) => {
          const raw = typeof data === 'string' ? data : String(data);
          wsManager.handleMessage(clientId, raw);
        });

        wsConn.on('close', () => {
          wsManager.removeClient(clientId);
        });

        wsConn.on('error', () => {
          wsManager.removeClient(clientId);
        });
      });
    });

    console.log('[ws] WebSocket handler attached for /api/v1/dispatch/ws');
  } catch {
    console.log('[ws] ws package not installed — WebSocket support disabled. Run: pnpm --filter @liminal/api add ws');
  }
}
