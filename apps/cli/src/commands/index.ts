import type { Session } from '../session/session.js';

export interface Command {
  name: string;
  description: string;
  usage?: string;
  execute(args: string[], session: Session): Promise<string | void>;
}

export const commands = new Map<string, Command>();

export function registerCommand(cmd: Command): void {
  commands.set(cmd.name, cmd);
}

/**
 * Parse a slash command from a raw input string.
 *
 * Returns `null` if the input doesn't start with `/`.
 * Otherwise returns `{ name, args }` where `args` is the
 * whitespace-split remainder of the line.
 */
export function parseCommand(input: string): { name: string; args: string[] } | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) return null;

  // Strip the leading slash and split on whitespace
  const parts = trimmed.slice(1).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;

  const name = parts[0]!.toLowerCase();
  const args = parts.slice(1);

  return { name, args };
}
