import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import {
  createCoworkSession,
  getCoworkSession,
  listCoworkSessions,
  updateCoworkSession,
  addCoworkMessage,
  getCoworkMessages,
} from '@liminal/db';
import { CoworkOrchestrator } from '@liminal/inference';

const orchestrator = new CoworkOrchestrator();

export const coworkRouter = new Hono();

// GET / — list cowork sessions
coworkRouter.get('/', (c) => {
  const sessions = listCoworkSessions();
  return c.json({ sessions });
});

// GET /:id — get session details
coworkRouter.get('/:id', (c) => {
  const session = getCoworkSession(c.req.param('id'));
  if (!session) return c.json({ error: 'Session not found' }, 404);
  const messages = getCoworkMessages(session.id);
  return c.json({ session, messages });
});

// POST / — create and start a cowork session
coworkRouter.post('/', async (c) => {
  const body = await c.req.json<{
    task: string;
    agents: Array<{ role: string; model?: string; enabled?: boolean }>;
    mode?: 'pipeline' | 'parallel' | 'discussion';
    conversation_id?: string;
    max_rounds?: number;
  }>();

  if (!body.task || !body.agents?.length) {
    return c.json({ error: 'Task and agents required' }, 400);
  }

  // Create DB record
  const session = createCoworkSession({
    conversationId: body.conversation_id ?? undefined,
    task: body.task,
    agentsConfig: JSON.stringify(body.agents),
  });

  return c.json({ session, message: 'Session created' }, 201);
});

// GET /:id/start — execute the cowork session (SSE streaming)
// NOTE: Must be GET because EventSource only supports GET requests.
coworkRouter.get('/:id/start', async (c) => {
  const session = getCoworkSession(c.req.param('id'));
  if (!session) return c.json({ error: 'Session not found' }, 404);

  const agents = JSON.parse(session.agentsConfig) as Array<{ role: string; model?: string; enabled?: boolean }>;

  return streamSSE(c, async (stream) => {
    updateCoworkSession(session.id, { status: 'running' });

    try {
      const result = await orchestrator.createSession({
        task: session.task,
        agents: agents.map((a) => ({
          role: a.role as 'architect' | 'coder' | 'reviewer' | 'tester' | 'security' | 'researcher',
          model: a.model,
          enabled: a.enabled !== false,
        })),
        mode: 'pipeline',
      });

      // Store messages in DB and stream to client
      for (const msg of result.messages) {
        addCoworkMessage({
          sessionId: session.id,
          agentRole: msg.agentRole,
          content: msg.content,
          sequence: msg.sequence,
        });

        await stream.writeSSE({
          event: 'agent_message',
          data: JSON.stringify({
            type: 'agent_message',
            agent_role: msg.agentRole,
            content: msg.content,
            sequence: msg.sequence,
          }),
        });
      }

      updateCoworkSession(session.id, {
        status: result.status,
        result: result.finalOutput,
      });

      await stream.writeSSE({
        event: 'done',
        data: JSON.stringify({
          type: 'done',
          status: result.status,
          duration_ms: result.durationMs,
        }),
      });
    } catch (err) {
      updateCoworkSession(session.id, { status: 'failed', result: String(err) });
      await stream.writeSSE({
        event: 'error',
        data: JSON.stringify({
          type: 'error',
          error: err instanceof Error ? err.message : String(err),
        }),
      });
    }
  });
});

// DELETE /:id — delete a session
coworkRouter.delete('/:id', (c) => {
  // For now, just mark as deleted
  updateCoworkSession(c.req.param('id'), { status: 'deleted' });
  return c.json({ success: true });
});
