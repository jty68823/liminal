import { Hono } from 'hono';
import { z } from 'zod';
import { addSkill, listSkills, getSkill, updateSkill, deleteSkill } from '@liminal/db';
import { analyzeSkill, validateSkill } from '@liminal/tools/skills';

export const skillsRouter = new Hono();

// GET /api/v1/skills — list installed skills
skillsRouter.get('/', (c) => {
  const rows = listSkills();
  return c.json({ skills: rows });
});

// GET /api/v1/skills/marketplace/browse — search remote marketplace
// Must be before /:id to avoid matching "marketplace" as an id
skillsRouter.get('/marketplace/browse', (c) => {
  const sampleSkills = [
    {
      name: 'code-reviewer',
      description: 'Automated code review with best practices analysis',
      version: '1.0.0',
      author: 'Liminal Community',
      risk_score: 5,
    },
    {
      name: 'api-tester',
      description: 'Test REST APIs with structured request/response analysis',
      version: '1.0.0',
      author: 'Liminal Community',
      risk_score: 15,
    },
    {
      name: 'sql-assistant',
      description: 'Help write and optimize SQL queries',
      version: '1.0.0',
      author: 'Liminal Community',
      risk_score: 10,
    },
    {
      name: 'markdown-writer',
      description: 'Professional markdown document generation',
      version: '1.0.0',
      author: 'Liminal Community',
      risk_score: 0,
    },
  ];
  return c.json({ skills: sampleSkills });
});

// GET /api/v1/skills/:id — get skill details
skillsRouter.get('/:id', (c) => {
  const id = c.req.param('id');
  const skill = getSkill(id);
  if (!skill) return c.json({ error: 'Skill not found' }, 404);
  return c.json({ skill });
});

// POST /api/v1/skills/install — install a skill
const InstallSkillSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  version: z.string().optional(),
  author: z.string().optional(),
  content: z.string().min(1),
  source_url: z.string().url().optional(),
});

skillsRouter.post('/install', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const result = InstallSkillSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: 'Validation failed', details: result.error.flatten() }, 400);
  }

  const { name, description, version, author, content, source_url } = result.data;

  // Validate skill content
  const analysis = analyzeSkill(content);

  if (analysis.validation.isBlocked) {
    return c.json({
      error: 'Skill blocked',
      reason: 'Contains dangerous patterns that cannot be installed',
      warnings: analysis.validation.warnings,
    }, 403);
  }

  const skill = addSkill({
    name,
    description: description ?? analysis.metadata.description,
    version: version ?? analysis.metadata.version,
    author: author ?? analysis.metadata.author,
    content,
    riskScore: analysis.validation.riskScore,
    sourceUrl: source_url,
  });

  return c.json({ skill, validation: analysis.validation }, 201);
});

// POST /api/v1/skills/:id/verify — verify/scan a skill
skillsRouter.post('/:id/verify', (c) => {
  const id = c.req.param('id');
  const skill = getSkill(id);
  if (!skill) return c.json({ error: 'Skill not found' }, 404);

  const analysis = analyzeSkill(skill.content);

  // Update risk score
  updateSkill(id, { riskScore: analysis.validation.riskScore });

  return c.json({
    skill_id: id,
    metadata: analysis.metadata,
    validation: analysis.validation,
  });
});

// PATCH /api/v1/skills/:id — toggle enabled/disabled
const PatchSkillSchema = z.object({
  enabled: z.boolean().optional(),
});

skillsRouter.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const skill = getSkill(id);
  if (!skill) return c.json({ error: 'Skill not found' }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const result = PatchSkillSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: 'Validation failed' }, 400);
  }

  if (result.data.enabled !== undefined) {
    updateSkill(id, { enabled: result.data.enabled ? 1 : 0 });
  }

  const updated = getSkill(id);
  return c.json({ skill: updated });
});

// DELETE /api/v1/skills/:id — remove skill
skillsRouter.delete('/:id', (c) => {
  const id = c.req.param('id');
  const skill = getSkill(id);
  if (!skill) return c.json({ error: 'Skill not found' }, 404);

  deleteSkill(id);
  return c.json({ success: true });
});
