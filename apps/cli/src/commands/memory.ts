import fs from 'fs';
import path from 'path';
import os from 'os';
import { registerCommand } from './index.js';
import type { Session } from '../session/session.js';

/**
 * Simple file-backed memory store.
 * Memories are stored as one JSON array in:
 *   ~/.config/liminal/memories.json   (or XDG_CONFIG_HOME equivalent)
 */

function getMemoryPath(): string {
  const base =
    process.env['XDG_CONFIG_HOME'] ??
    path.join(os.homedir(), '.config');
  return path.join(base, 'liminal', 'memories.json');
}

function loadMemories(): string[] {
  const filePath = getMemoryPath();
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function saveMemories(memories: string[]): void {
  const filePath = getMemoryPath();
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(memories, null, 2), 'utf8');
}

/**
 * /memory — list or add explicit memories.
 *
 *   /memory            — list all stored memories
 *   /memory add <text> — add a new memory
 */
registerCommand({
  name: 'memory',
  description: 'List or add persistent memories',
  usage: '/memory [add <text>]',

  async execute(args: string[], _session: Session): Promise<string> {
    // /memory add <text>
    if (args[0]?.toLowerCase() === 'add') {
      const text = args.slice(1).join(' ').trim();
      if (!text) {
        return 'Usage: /memory add <text>';
      }

      const memories = loadMemories();
      memories.push(text);
      saveMemories(memories);

      return `Memory saved: "${text}"`;
    }

    // /memory (list)
    const memories = loadMemories();

    if (memories.length === 0) {
      return (
        'No memories stored yet.\n' +
        'Use /memory add <text> to save something for future sessions.'
      );
    }

    const lines: string[] = ['', '  Stored memories:', ''];
    memories.forEach((m, i) => {
      lines.push(`  ${String(i + 1).padStart(3)}. ${m}`);
    });
    lines.push('');
    lines.push(`  Total: ${memories.length}  —  stored at ${getMemoryPath()}`);
    lines.push('');

    return lines.join('\n');
  },
});
