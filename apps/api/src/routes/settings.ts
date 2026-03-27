/**
 * Settings API routes — manage app configuration (providers, models, etc.)
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { getSetting, setSetting, deleteSetting, listSettings, getSettingParsed, setSettingJson } from '@liminal/db';
import { providerRegistry } from '@liminal/inference';
import { invalidateCache } from '../middleware/cache.js';

export const settingsRouter = new Hono();

// Restore persisted settings to process.env on startup
try {
  const savedEnableComputerUse = getSetting('enable_computer_use');
  if (savedEnableComputerUse === 'true' || savedEnableComputerUse === '1') {
    process.env['ENABLE_COMPUTER_USE'] = '1';
  }
  const savedDefaultModel = getSetting('default_model');
  if (savedDefaultModel) process.env['LIMINAL_DEFAULT_MODEL'] = savedDefaultModel;
} catch {
  // DB may not be ready at import time — OK
}

// GET / — list all settings
settingsRouter.get('/', (c) => {
  const all = listSettings();
  // Parse JSON values where possible
  const parsed = all.map((s) => {
    try {
      return { key: s.key, value: JSON.parse(s.value), updatedAt: s.updatedAt };
    } catch {
      return { key: s.key, value: s.value, updatedAt: s.updatedAt };
    }
  });
  return c.json({ settings: parsed });
});

const SetSettingSchema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
});

// PUT / — set a setting
settingsRouter.put('/', async (c) => {
  const body = await c.req.json();
  const parsed = SetSettingSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const { key, value } = parsed.data;
  const strValue = typeof value === 'string' ? value : JSON.stringify(value);
  const result = setSetting(key, strValue);

  // ── Immediately apply runtime-adjustable settings ──────────────────────
  if (key === 'enable_computer_use') {
    if (strValue === 'true' || strValue === '1') {
      process.env['ENABLE_COMPUTER_USE'] = '1';
    } else {
      delete process.env['ENABLE_COMPUTER_USE'];
    }
  }
  if (key === 'default_model') {
    process.env['LIMINAL_DEFAULT_MODEL'] = strValue;
  }

  // Invalidate settings cache so the next GET sees the updated value
  invalidateCache('/api/v1/settings');

  return c.json({ key: result.key, value, updatedAt: result.updatedAt });
});

// ── Provider-specific endpoints ─────────────────────────────────────────────
// NOTE: These must be registered BEFORE the generic /:key route to avoid
// the wildcard swallowing /providers/list, /providers/switch, etc.

// GET /providers/list — list registered providers
settingsRouter.get('/providers/list', (c) => {
  const providers = providerRegistry.listAll();
  return c.json({ providers });
});

// POST /providers/switch — switch active provider
const SwitchProviderSchema = z.object({
  providerId: z.string().min(1),
});

settingsRouter.post('/providers/switch', async (c) => {
  const body = await c.req.json();
  const parsed = SwitchProviderSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed' }, 400);
  }

  try {
    providerRegistry.setActive(parsed.data.providerId);
    setSetting('active_provider', parsed.data.providerId);
    return c.json({ active: parsed.data.providerId });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 400);
  }
});

// POST /providers/add — register a new OpenAI-compatible provider
const AddProviderSchema = z.object({
  type: z.enum(['llamacpp', 'openai-compat']),
  baseUrl: z.string().url(),
  apiKey: z.string().optional(),
  displayName: z.string().optional(),
  defaultModel: z.string().optional(),
  isActive: z.boolean().optional(),
});

settingsRouter.post('/providers/add', async (c) => {
  const body = await c.req.json();
  const parsed = AddProviderSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  try {
    const provider = providerRegistry.registerFromConfig({
      type: parsed.data.type,
      baseUrl: parsed.data.baseUrl,
      apiKey: parsed.data.apiKey,
      isActive: parsed.data.isActive,
    });

    // Save provider config to DB
    const configs = getSettingParsed<Array<Record<string, unknown>>>('provider_configs', []);
    configs.push(parsed.data);
    setSettingJson('provider_configs', configs);

    return c.json({ provider: { id: provider.id, displayName: provider.displayName } });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 400);
  }
});

// GET /providers/health — check health of active provider
settingsRouter.get('/providers/health', async (c) => {
  const provider = providerRegistry.getActive();
  const healthy = await provider.healthCheck();
  return c.json({
    provider: provider.id,
    displayName: provider.displayName,
    healthy,
  });
});

// ── Generic key endpoints (must come AFTER /providers/* routes) ───────────────

// GET /:key — get a single setting
settingsRouter.get('/:key', (c) => {
  const key = c.req.param('key');
  const value = getSetting(key);
  if (value === null) {
    return c.json({ error: 'Setting not found' }, 404);
  }
  try {
    return c.json({ key, value: JSON.parse(value) });
  } catch {
    return c.json({ key, value });
  }
});

// DELETE /:key — delete a setting
settingsRouter.delete('/:key', (c) => {
  const key = c.req.param('key');
  deleteSetting(key);
  return c.json({ ok: true });
});
