import { registerCommand, commands } from './index.js';
import type { Session } from '../session/session.js';

registerCommand({
  name: 'help',
  description: 'List all available commands',
  usage: '/help',

  async execute(_args: string[], _session: Session): Promise<string> {
    const lines: string[] = [
      '',
      '  Available commands:',
      '',
    ];

    // Sort commands alphabetically for a predictable listing
    const sorted = Array.from(commands.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );

    for (const cmd of sorted) {
      const usage = cmd.usage ?? `/${cmd.name}`;
      const padding = ' '.repeat(Math.max(1, 24 - usage.length));
      lines.push(`  ${usage}${padding}${cmd.description}`);
    }

    lines.push('');
    lines.push('  Start typing to chat. Press Ctrl+C or Ctrl+D to exit.');
    lines.push('');

    return lines.join('\n');
  },
});
