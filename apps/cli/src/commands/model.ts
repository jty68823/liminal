import { registerCommand } from './index.js';
import { ApiClient } from '../api/client.js';
import type { Session } from '../session/session.js';

/**
 * /model [name] — list or switch the active model.
 *
 * Without arguments: lists all models returned by GET /api/v1/models.
 * With a model name: updates session.model to that name.
 */
registerCommand({
  name: 'model',
  description: 'List available models or switch to a different one',
  usage: '/model [name]',

  async execute(args: string[], session: Session): Promise<string> {
    const client = new ApiClient(session.apiUrl);

    // Switch model
    if (args.length > 0) {
      const requested = args.join(' ').trim();
      session.model = requested;
      return `Switched to model: ${requested}`;
    }

    // List models
    let models;
    try {
      models = await client.listModels();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return `Could not fetch models: ${msg}`;
    }

    if (models.length === 0) {
      return (
        'No models found. Make sure the Liminal AI engine is running and you have at least one model loaded.\n' +
        'Example: place a GGUF file in the models directory'
      );
    }

    const lines: string[] = ['', '  Available models:', ''];

    for (const m of models) {
      const active = m.name === session.model ? ' (active)' : '';
      const ctx = m.context_length ? ` ${(m.context_length / 1000).toFixed(0)}k ctx` : '';
      const sizeMb = m.size ? ` ${(m.size / 1_073_741_824).toFixed(1)} GB` : '';
      const label = m.display_name !== m.name ? ` — ${m.display_name}` : '';
      lines.push(`  ${m.name}${label}${ctx}${sizeMb}${active}`);
    }

    lines.push('');
    lines.push(`  Current model: ${session.model}`);
    lines.push('  Use /model <name> to switch.');
    lines.push('');

    return lines.join('\n');
  },
});
