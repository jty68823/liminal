import { Hono } from 'hono';
import { listMemory, deleteMemory } from '@liminal/db';
import { addMemoryWithEmbedding } from '../services/memory.service.js';

export const memoryRouter = new Hono();

memoryRouter.get('/', (c) => {
  const projectId = c.req.query('project_id');
  const limit = parseInt(c.req.query('limit') ?? '50', 10);
  const rows = listMemory({ projectId: projectId ?? undefined, limit });
  return c.json(rows);
});

memoryRouter.post('/', async (c) => {
  const body = await c.req.json();
  const { content, project_id, conversation_id, source } = body;
  if (!content || typeof content !== 'string') {
    return c.json({ error: 'content is required' }, 400);
  }
  await addMemoryWithEmbedding({
    content,
    projectId: project_id,
    conversationId: conversation_id,
    source: source ?? 'explicit',
  });
  return c.json({ success: true }, 201);
});

memoryRouter.delete('/:id', (c) => {
  const id = c.req.param('id');
  deleteMemory(id);
  return c.json({ success: true });
});
