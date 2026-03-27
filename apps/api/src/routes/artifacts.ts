import { Hono } from 'hono';
import { z } from 'zod';
import { getArtifact, updateArtifactContent } from '../services/artifact.service.js';

export const artifactsRouter = new Hono();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const UpdateArtifactSchema = z.object({
  content: z.string().min(1, 'Content cannot be empty'),
  title: z.string().optional(),
});

// ---------------------------------------------------------------------------
// GET /:id — get artifact by ID
// ---------------------------------------------------------------------------

artifactsRouter.get('/:id', (c) => {
  const id = c.req.param('id');
  const artifact = getArtifact(id);
  if (!artifact) {
    return c.json({ error: 'Artifact not found' }, 404);
  }
  return c.json({ artifact });
});

// ---------------------------------------------------------------------------
// PATCH /:id — update artifact content (increments version)
// ---------------------------------------------------------------------------

artifactsRouter.patch('/:id', async (c) => {
  const id = c.req.param('id');

  // Verify existence before parsing body
  const existing = getArtifact(id);
  if (!existing) {
    return c.json({ error: 'Artifact not found' }, 404);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const parseResult = UpdateArtifactSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten() }, 400);
  }

  const updated = updateArtifactContent(id, parseResult.data.content);
  if (!updated) {
    return c.json({ error: 'Failed to update artifact' }, 500);
  }

  return c.json({ artifact: updated });
});
