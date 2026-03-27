import { Hono } from 'hono';
import { z } from 'zod';
import {
  listProjects,
  createProject,
  getProject,
  updateProject,
  deleteProject,
  listConversations,
} from '@liminal/db';

export const projectsRouter = new Hono();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const CreateProjectSchema = z.object({
  name: z.string().min(1, 'Project name cannot be empty'),
  description: z.string().optional(),
  system_prompt: z.string().optional(),
  root_path: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const UpdateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  system_prompt: z.string().optional(),
  root_path: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ---------------------------------------------------------------------------
// GET / — list all projects
// ---------------------------------------------------------------------------

projectsRouter.get('/', (c) => {
  const projects = listProjects();
  return c.json({ projects });
});

// ---------------------------------------------------------------------------
// POST / — create project
// ---------------------------------------------------------------------------

projectsRouter.post('/', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const parseResult = CreateProjectSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten() }, 400);
  }

  const { name, description, system_prompt, root_path, metadata } = parseResult.data;

  const project = createProject({
    name,
    description,
    systemPrompt: system_prompt,
    rootPath: root_path,
    metadata: metadata ? JSON.stringify(metadata) : undefined,
  });

  return c.json({ project }, 201);
});

// ---------------------------------------------------------------------------
// GET /:id — get project by ID
// ---------------------------------------------------------------------------

projectsRouter.get('/:id', (c) => {
  const id = c.req.param('id');
  const project = getProject(id);
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }
  return c.json({ project });
});

// ---------------------------------------------------------------------------
// PATCH /:id — update project
// ---------------------------------------------------------------------------

projectsRouter.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const existing = getProject(id);
  if (!existing) {
    return c.json({ error: 'Project not found' }, 404);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const parseResult = UpdateProjectSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten() }, 400);
  }

  const updates: Record<string, unknown> = {};
  if (parseResult.data.name !== undefined) updates['name'] = parseResult.data.name;
  if (parseResult.data.description !== undefined) updates['description'] = parseResult.data.description;
  if (parseResult.data.system_prompt !== undefined) updates['systemPrompt'] = parseResult.data.system_prompt;
  if (parseResult.data.root_path !== undefined) updates['rootPath'] = parseResult.data.root_path;
  if (parseResult.data.metadata !== undefined) {
    updates['metadata'] = JSON.stringify(parseResult.data.metadata);
  }

  if (Object.keys(updates).length > 0) {
    updateProject(id, updates as Parameters<typeof updateProject>[1]);
  }

  const updated = getProject(id);
  return c.json({ project: updated });
});

// ---------------------------------------------------------------------------
// DELETE /:id — delete project
// ---------------------------------------------------------------------------

projectsRouter.delete('/:id', (c) => {
  const id = c.req.param('id');
  const existing = getProject(id);
  if (!existing) {
    return c.json({ error: 'Project not found' }, 404);
  }

  deleteProject(id);
  return c.json({ success: true });
});

// ---------------------------------------------------------------------------
// GET /:id/conversations — list conversations belonging to a project
// ---------------------------------------------------------------------------

projectsRouter.get('/:id/conversations', (c) => {
  const id = c.req.param('id');
  const existing = getProject(id);
  if (!existing) {
    return c.json({ error: 'Project not found' }, 404);
  }

  const limitParam = c.req.query('limit');
  const offsetParam = c.req.query('offset');
  const limit = limitParam ? parseInt(limitParam, 10) : 50;
  const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

  const conversations = listConversations({ projectId: id, limit, offset });
  return c.json({ conversations, project_id: id, limit, offset });
});
