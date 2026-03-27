import { Hono } from 'hono';
import { providerRegistry } from '@liminal/inference';
import { KNOWN_MODELS, DEFAULT_MODELS } from '@liminal/core';

export const modelsRouter = new Hono();

// ---------------------------------------------------------------------------
// GET / — list all available models from active provider
// ---------------------------------------------------------------------------

modelsRouter.get('/', async (c) => {
  const provider = providerRegistry.getActive();

  try {
    const models = await provider.listModels();

    // Enrich with known model metadata where available
    const enriched = models.map((m) => {
      const known = KNOWN_MODELS.find(
        (k) => k.name === m.name || k.name.toLowerCase() === m.name.toLowerCase(),
      );
      return {
        name: m.name,
        size: m.size,
        modified_at: m.modified_at,
        display_name: known?.displayName ?? m.name,
        context_length: known?.contextLength ?? null,
        is_default: known?.isDefault ?? false,
        task_types: known?.taskTypes ?? [],
        provider: provider.id,
      };
    });

    return c.json({ models: enriched, provider: provider.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json(
      { error: 'Failed to reach inference provider', details: message, models: [], provider: provider.id },
      503,
    );
  }
});

// ---------------------------------------------------------------------------
// GET /default — get the currently configured default models per task type
// ---------------------------------------------------------------------------

modelsRouter.get('/default', (c) => {
  const defaults = {
    general: process.env['LIMINAL_DEFAULT_MODEL'] ?? DEFAULT_MODELS['general'],
    code: process.env['LIMINAL_CODE_MODEL'] ?? DEFAULT_MODELS['code'],
    fast: process.env['LIMINAL_FAST_MODEL'] ?? DEFAULT_MODELS['fast'],
    embed: process.env['LIMINAL_EMBED_MODEL'] ?? DEFAULT_MODELS['embed'],
  };
  return c.json({ defaults });
});
