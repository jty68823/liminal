import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { streamSSE } from 'hono/streaming';
import { messagesRouter } from './routes/messages.js';
import { conversationsRouter } from './routes/conversations.js';
import { projectsRouter } from './routes/projects.js';
import { artifactsRouter } from './routes/artifacts.js';
import { modelsRouter } from './routes/models.js';
import { toolsRouter } from './routes/tools.js';
import { memoryRouter } from './routes/memory.js';
import { mcpRouter } from './routes/mcp.js';
import { skillsRouter } from './routes/skills.js';
import { settingsRouter } from './routes/settings.js';
import { documentsRouter } from './routes/documents.js';
import { coworkRouter } from './routes/cowork.js';
import { autoTaskRouter } from './routes/auto-task.js';
import { rateLimiter } from './middleware/rate-limiter.js';
import { securityHeaders } from './middleware/security-headers.js';
import { requestId } from './middleware/request-id.js';
import { cacheMiddleware } from './middleware/cache.js';
import { performanceMiddleware, getPerformanceStats } from './middleware/performance.js';

export const app = new Hono();

app.use('*', logger());
app.use('*', cors({ origin: ['http://localhost:3000', 'http://127.0.0.1:3000'] }));
app.use('*', securityHeaders());
app.use('*', requestId());
app.use('*', performanceMiddleware());
app.use('*', rateLimiter({ max: 100, window: 60_000 }));
// Stricter limit for streaming message endpoint
app.use('/api/v1/messages*', rateLimiter({ max: 10, window: 60_000 }));

// Cache static/slow-changing endpoints
app.use('/api/v1/models', cacheMiddleware({ ttl: 30_000 }));
app.use('/api/v1/tools', cacheMiddleware({ ttl: 60_000 }));
app.use('/api/v1/settings', cacheMiddleware({ ttl: 10_000 }));

app.get('/health', (c) => c.json({ status: 'ok', timestamp: Date.now() }));

// Aliased under /api/v1/ for clients using the Next.js proxy rewrite
app.get('/api/v1/health', (c) => c.json({ status: 'ok', timestamp: Date.now() }));

// Root endpoint — informational
app.get('/', (c) => c.json({
  name: 'Liminal API',
  version: '0.1.0',
  status: 'running',
  docs: '/health',
  web: 'http://localhost:3000',
}));

// Performance metrics endpoint
app.get('/health/metrics', (c) => c.json(getPerformanceStats()));

// SSE test endpoint
app.get('/test-sse', (c) => {
  return streamSSE(c, async (stream) => {
    for (let i = 0; i < 5; i++) {
      await stream.writeSSE({ data: JSON.stringify({ type: 'token', delta: `token${i} ` }) });
      await new Promise(r => setTimeout(r, 100));
    }
    await stream.writeSSE({ data: JSON.stringify({ type: 'done' }) });
  });
});

app.route('/api/v1/messages', messagesRouter);
app.route('/api/v1/conversations', conversationsRouter);
app.route('/api/v1/projects', projectsRouter);
app.route('/api/v1/artifacts', artifactsRouter);
app.route('/api/v1/models', modelsRouter);
app.route('/api/v1/tools', toolsRouter);
app.route('/api/v1/memory', memoryRouter);
app.route('/api/v1/mcp', mcpRouter);
app.route('/api/v1/skills', skillsRouter);
app.route('/api/v1/settings', settingsRouter);
app.route('/api/v1/documents', documentsRouter);
app.route('/api/v1/cowork', coworkRouter);
app.route('/api/v1/auto-task', autoTaskRouter);

export default app;
