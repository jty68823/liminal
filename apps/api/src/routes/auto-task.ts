import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import {
  createAutoTaskRun,
  getAutoTaskRun,
  listAutoTaskRuns,
  updateAutoTaskRun,
  appendAutoTaskEvent,
  getAutoTaskEvents,
  getSettingParsed,
} from '@liminal/db';
import { autoTaskOrchestrator, agentRegistry } from '@liminal/inference';
import type { AutoTaskEvent, ConcurrencyStrategy } from '@liminal/inference';

export const autoTaskRouter = new Hono();

// Extended run type with concurrency fields
interface AutoTaskRunWithConcurrency {
  maxConcurrent?: number;
  concurrencyStrategy?: string;
}

const CreateAutoTaskSchema = z.object({
  objective: z.string().min(1, 'Objective is required'),
  security_level: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
  max_concurrent: z.number().int().min(1).max(10).optional(),
  concurrency_strategy: z.enum(['fixed', 'auto']).optional(),
  max_clamp: z.number().int().min(1).max(10).optional(),
  enable_qa: z.boolean().optional(),
});

// GET / — list runs
autoTaskRouter.get('/', (c) => {
  const runs = listAutoTaskRuns();
  return c.json({ runs });
});

// GET /agents — list all registered agents (base + dynamic)
autoTaskRouter.get('/agents', (c) => {
  const agents = agentRegistry.listAll();
  return c.json({ agents });
});

// POST /agents — manually create a dynamic agent
const CreateAgentSchema = z.object({
  role: z.string().min(1).regex(/^[a-z][a-z0-9_]*$/, 'Role must be snake_case'),
  label: z.string().min(1),
  description: z.string().min(1),
  systemPrompt: z.string().min(1),
  color: z.string().optional(),
  icon: z.string().optional(),
});

autoTaskRouter.post('/agents', async (c) => {
  const body = await c.req.json();
  const parsed = CreateAgentSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input' }, 400);
  }

  try {
    const role = agentRegistry.register({
      role: parsed.data.role,
      label: parsed.data.label,
      description: parsed.data.description,
      systemPrompt: parsed.data.systemPrompt,
      color: parsed.data.color ?? '#94a3b8',
      icon: parsed.data.icon ?? '🤖',
    });
    return c.json({ role, message: 'Dynamic agent created' }, 201);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 400);
  }
});

// DELETE /agents/:role — remove a dynamic agent (base roles protected)
autoTaskRouter.delete('/agents/:role', (c) => {
  const role = c.req.param('role');
  if (agentRegistry.isBaseRole(role)) {
    return c.json({ error: 'Cannot remove base agent role' }, 403);
  }
  const removed = agentRegistry.unregister(role);
  if (!removed) {
    return c.json({ error: 'Agent not found' }, 404);
  }
  return c.json({ success: true });
});

// GET /:id — get run details + events
autoTaskRouter.get('/:id', (c) => {
  const run = getAutoTaskRun(c.req.param('id'));
  if (!run) return c.json({ error: 'Run not found' }, 404);
  const events = getAutoTaskEvents(run.id);
  return c.json({ run, events });
});

// POST / — create a new auto task run
autoTaskRouter.post('/', async (c) => {
  const body = await c.req.json();
  const parsed = CreateAutoTaskSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input' }, 400);
  }

  // Read defaults from settings, then let per-request overrides win
  const savedMaxConcurrent = getSettingParsed<number>('auto_task_max_concurrent', 3);
  const savedStrategy = getSettingParsed<ConcurrencyStrategy>('auto_task_concurrency_strategy', 'fixed');

  const run = createAutoTaskRun({
    objective: parsed.data.objective,
    securityLevel: parsed.data.security_level,
    maxConcurrent: parsed.data.max_concurrent ?? savedMaxConcurrent,
    concurrencyStrategy: parsed.data.concurrency_strategy ?? savedStrategy,
  });

  return c.json({ run, message: 'Auto task created' }, 201);
});

// GET /:id/stream — SSE stream for live execution
// NOTE: Must be GET because EventSource only supports GET requests.
autoTaskRouter.get('/:id/stream', async (c) => {
  const run = getAutoTaskRun(c.req.param('id'));
  if (!run) return c.json({ error: 'Run not found' }, 404);

  return streamSSE(c, async (stream) => {
    updateAutoTaskRun(run.id, { status: 'planning' });

    // Replay existing events first (reconnect support)
    const existingEvents = getAutoTaskEvents(run.id);
    for (const ev of existingEvents) {
      await stream.writeSSE({
        event: ev.type,
        data: ev.payload,
      });
    }

    // If already completed/failed/cancelled, just send done and exit
    const currentRun = getAutoTaskRun(run.id);
    if (
      currentRun &&
      ['completed', 'failed', 'cancelled'].includes(currentRun.status)
    ) {
      return;
    }

    const startTime = Date.now();

    // Read configurable clamp and QA setting
    const savedMaxClamp = getSettingParsed<number>('auto_task_max_clamp', 5);
    const savedEnableQA = getSettingParsed<boolean>('auto_task_enable_qa', false);

    const onEvent = (event: AutoTaskEvent): void => {
      // Persist event to DB
      appendAutoTaskEvent({
        runId: run.id,
        type: event.type,
        payload: JSON.stringify(event),
        subtaskId: 'subtaskId' in event ? event.subtaskId : undefined,
      });

      // Stream to client (fire-and-forget within SSE context)
      stream.writeSSE({
        event: event.type,
        data: JSON.stringify(event),
      }).catch(() => {/* client disconnected */});
    };

    try {
      updateAutoTaskRun(run.id, { status: 'executing' });

      await autoTaskOrchestrator.run(
        run.id,
        run.objective,
        run.securityLevel as 1 | 2 | 3,
        {
          onEvent,
          model: process.env['LIMINAL_DEFAULT_MODEL'],
          maxConcurrent: (run as AutoTaskRunWithConcurrency).maxConcurrent,
          concurrencyStrategy: (run as AutoTaskRunWithConcurrency).concurrencyStrategy as ConcurrencyStrategy | undefined,
          maxClamp: savedMaxClamp,
          enableQA: savedEnableQA,
        },
      );

      updateAutoTaskRun(run.id, {
        status: 'completed',
        durationMs: Date.now() - startTime,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      updateAutoTaskRun(run.id, {
        status: 'failed',
        error: errorMsg,
        durationMs: Date.now() - startTime,
      });

      // Emit error event if not already done by orchestrator
      await stream.writeSSE({
        event: 'auto_task_error',
        data: JSON.stringify({ type: 'auto_task_error', runId: run.id, error: errorMsg }),
      });
    }
  });
});

// DELETE /:id — cancel a running task
autoTaskRouter.delete('/:id', (c) => {
  const id = c.req.param('id');
  const run = getAutoTaskRun(id);
  if (!run) return c.json({ error: 'Run not found' }, 404);

  autoTaskOrchestrator.abort(id);
  updateAutoTaskRun(id, { status: 'cancelled' });
  return c.json({ success: true });
});
