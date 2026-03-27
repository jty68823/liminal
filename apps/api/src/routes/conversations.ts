import { Hono } from 'hono';
import { z } from 'zod';
import {
  listConversations,
  createConversation,
  getConversation,
  updateConversation,
  deleteConversation,
  getMessages,
  createCheckpoint,
  listCheckpoints,
  getLatestCheckpoint,
} from '@liminal/db';
import { defaultRouter } from '@liminal/inference';

export const conversationsRouter = new Hono();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const CreateConversationSchema = z.object({
  model: z.string().optional(),
  project_id: z.string().optional(),
  title: z.string().optional(),
});

const UpdateConversationSchema = z.object({
  title: z.string().optional(),
  model: z.string().optional(),
  summary: z.string().optional(),
});

const PaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  project_id: z.string().optional(),
});

// ---------------------------------------------------------------------------
// GET / — list conversations
// ---------------------------------------------------------------------------

conversationsRouter.get('/', (c) => {
  const queryResult = PaginationSchema.safeParse(c.req.query());
  if (!queryResult.success) {
    return c.json({ error: 'Invalid query params', details: queryResult.error.flatten() }, 400);
  }

  const { limit, offset, project_id } = queryResult.data;

  const rows = listConversations({ projectId: project_id, limit, offset });
  return c.json({ conversations: rows, limit, offset });
});

// ---------------------------------------------------------------------------
// POST / — create conversation
// ---------------------------------------------------------------------------

conversationsRouter.post('/', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }

  const parseResult = CreateConversationSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten() }, 400);
  }

  const { model, project_id, title } = parseResult.data;
  const resolvedModel = model ?? defaultRouter.selectModel({});

  const conv = createConversation({
    model: resolvedModel,
    projectId: project_id,
    title,
  });

  return c.json({ conversation: conv }, 201);
});

// ---------------------------------------------------------------------------
// GET /:id — get conversation with messages
// ---------------------------------------------------------------------------

conversationsRouter.get('/:id', (c) => {
  const id = c.req.param('id');
  const conv = getConversation(id);
  if (!conv) {
    return c.json({ error: 'Conversation not found' }, 404);
  }

  const messages = getMessages(id, { limit: 200 });
  return c.json({ conversation: conv, messages });
});

// ---------------------------------------------------------------------------
// PATCH /:id — update title / metadata
// ---------------------------------------------------------------------------

conversationsRouter.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const existing = getConversation(id);
  if (!existing) {
    return c.json({ error: 'Conversation not found' }, 404);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const parseResult = UpdateConversationSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten() }, 400);
  }

  const updates: Record<string, unknown> = {};
  if (parseResult.data.title !== undefined) updates['title'] = parseResult.data.title;
  if (parseResult.data.model !== undefined) updates['model'] = parseResult.data.model;
  if (parseResult.data.summary !== undefined) updates['summary'] = parseResult.data.summary;

  if (Object.keys(updates).length > 0) {
    updateConversation(id, updates as Parameters<typeof updateConversation>[1]);
  }

  const updated = getConversation(id);
  return c.json({ conversation: updated });
});

// ---------------------------------------------------------------------------
// DELETE /:id — delete conversation
// ---------------------------------------------------------------------------

conversationsRouter.delete('/:id', (c) => {
  const id = c.req.param('id');
  const existing = getConversation(id);
  if (!existing) {
    return c.json({ error: 'Conversation not found' }, 404);
  }

  deleteConversation(id);
  return c.json({ success: true });
});

// ---------------------------------------------------------------------------
// GET /:id/messages — paginated message list
// ---------------------------------------------------------------------------

conversationsRouter.get('/:id/messages', (c) => {
  const id = c.req.param('id');
  const conv = getConversation(id);
  if (!conv) {
    return c.json({ error: 'Conversation not found' }, 404);
  }

  const queryResult = PaginationSchema.safeParse(c.req.query());
  if (!queryResult.success) {
    return c.json({ error: 'Invalid query params', details: queryResult.error.flatten() }, 400);
  }

  const { limit, offset } = queryResult.data;
  const messages = getMessages(id, { limit, offset });
  return c.json({ messages, conversation_id: id, limit, offset });
});

// ---------------------------------------------------------------------------
// GET /:id/checkpoints — list checkpoints for a conversation
// ---------------------------------------------------------------------------

conversationsRouter.get('/:id/checkpoints', (c) => {
  const id = c.req.param('id');
  const conv = getConversation(id);
  if (!conv) {
    return c.json({ error: 'Conversation not found' }, 404);
  }

  const cps = listCheckpoints(id);
  return c.json({ checkpoints: cps, conversation_id: id });
});

// ---------------------------------------------------------------------------
// POST /:id/checkpoint — create a checkpoint
// ---------------------------------------------------------------------------

conversationsRouter.post('/:id/checkpoint', (c) => {
  const id = c.req.param('id');
  const conv = getConversation(id);
  if (!conv) {
    return c.json({ error: 'Conversation not found' }, 404);
  }

  const msgs = getMessages(id, { limit: 200 });
  const cp = createCheckpoint(id, JSON.stringify(msgs));
  return c.json({ checkpoint: cp }, 201);
});

// ---------------------------------------------------------------------------
// POST /:id/undo — restore from latest checkpoint
// ---------------------------------------------------------------------------

conversationsRouter.post('/:id/undo', (c) => {
  const id = c.req.param('id');
  const conv = getConversation(id);
  if (!conv) {
    return c.json({ error: 'Conversation not found' }, 404);
  }

  const cp = getLatestCheckpoint(id);
  if (!cp) {
    return c.json({ error: 'No checkpoints available' }, 404);
  }

  const restoredMessages = JSON.parse(cp.messagesJson);
  return c.json({
    success: true,
    checkpoint_id: cp.id,
    messages: restoredMessages,
    restored_at: Date.now(),
  });
});
