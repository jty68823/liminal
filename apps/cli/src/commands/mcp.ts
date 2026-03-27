import { registerCommand } from './index.js';
import type { Session } from '../session/session.js';

/**
 * /mcp — manage MCP (Model Context Protocol) servers.
 *
 *   /mcp                            — list all configured MCP servers
 *   /mcp list                       — same as above
 *   /mcp add <name> <command> [args...] — add a new MCP server
 *   /mcp remove <name>              — remove a server by name
 *   /mcp enable <name>              — enable a server
 *   /mcp disable <name>             — disable a server
 */

function getApiUrl(): string {
  return process.env['LIMINAL_API_URL'] ?? 'http://localhost:3001';
}

interface McpServer {
  id: string | number;
  name: string;
  command: string;
  args: string[];
  enabled: number | boolean;
  createdAt?: string;
}

async function fetchServers(): Promise<McpServer[]> {
  const res = await fetch(`${getApiUrl()}/api/v1/mcp/servers`);
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }
  const data = await res.json() as { servers?: McpServer[] } | McpServer[];
  if (Array.isArray(data)) return data;
  return data.servers ?? [];
}

function formatTable(servers: McpServer[]): string {
  if (servers.length === 0) {
    return (
      '\n  No MCP servers configured.\n' +
      '  Use /mcp add <name> <command> [args...] to add one.\n'
    );
  }

  const lines: string[] = ['', '  MCP Servers:', ''];

  const nameW  = Math.max(4, ...servers.map((s) => s.name.length));
  const cmdW   = Math.max(7, ...servers.map((s) => s.command.length));
  const argsW  = Math.max(4, ...servers.map((s) => (s.args ?? []).join(' ').length));

  const sep = `  ${'─'.repeat(nameW + cmdW + argsW + 16)}`;
  const header =
    `  ${'NAME'.padEnd(nameW)}  ${'COMMAND'.padEnd(cmdW)}  ${'ARGS'.padEnd(argsW)}  STATUS`;

  lines.push(sep);
  lines.push(header);
  lines.push(sep);

  for (const s of servers) {
    const status = s.enabled ? 'enabled' : 'disabled';
    const argsStr = (s.args ?? []).join(' ');
    lines.push(
      `  ${s.name.padEnd(nameW)}  ${s.command.padEnd(cmdW)}  ${argsStr.padEnd(argsW)}  ${status}`,
    );
  }

  lines.push(sep);
  lines.push(`  Total: ${servers.length}`);
  lines.push('');

  return lines.join('\n');
}

registerCommand({
  name: 'mcp',
  description: 'Manage MCP (Model Context Protocol) servers',
  usage: '/mcp [list | add <name> <cmd> [args...] | remove <name> | enable <name> | disable <name>]',

  async execute(args: string[], _session: Session): Promise<string> {
    const sub = args[0]?.toLowerCase() ?? 'list';

    // ------------------------------------------------------------------
    // /mcp  /mcp list
    // ------------------------------------------------------------------
    if (sub === 'list' || args.length === 0) {
      try {
        const servers = await fetchServers();
        return formatTable(servers);
      } catch (err) {
        return `Failed to list MCP servers: ${(err as Error).message}`;
      }
    }

    // ------------------------------------------------------------------
    // /mcp add <name> <command> [args...]
    // ------------------------------------------------------------------
    if (sub === 'add') {
      const name    = args[1];
      const command = args[2];
      const cmdArgs = args.slice(3);

      if (!name || !command) {
        return 'Usage: /mcp add <name> <command> [args...]';
      }

      try {
        const res = await fetch(`${getApiUrl()}/api/v1/mcp/servers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, command, args: cmdArgs, enabled: 1 }),
        });

        if (!res.ok) {
          return `Failed to add MCP server: ${await res.text()}`;
        }

        return `MCP server "${name}" added successfully.`;
      } catch (err) {
        return `Failed to add MCP server: ${(err as Error).message}`;
      }
    }

    // ------------------------------------------------------------------
    // /mcp remove <name>
    // ------------------------------------------------------------------
    if (sub === 'remove') {
      const name = args[1];
      if (!name) return 'Usage: /mcp remove <name>';

      try {
        const servers = await fetchServers();
        const server  = servers.find((s) => s.name === name);
        if (!server) return `MCP server "${name}" not found.`;

        const res = await fetch(`${getApiUrl()}/api/v1/mcp/servers/${server.id}`, {
          method: 'DELETE',
        });

        if (!res.ok) {
          return `Failed to remove MCP server: ${await res.text()}`;
        }

        return `MCP server "${name}" removed.`;
      } catch (err) {
        return `Failed to remove MCP server: ${(err as Error).message}`;
      }
    }

    // ------------------------------------------------------------------
    // /mcp enable <name>  /mcp disable <name>
    // ------------------------------------------------------------------
    if (sub === 'enable' || sub === 'disable') {
      const name    = args[1];
      const enabled = sub === 'enable' ? 1 : 0;

      if (!name) return `Usage: /mcp ${sub} <name>`;

      try {
        const servers = await fetchServers();
        const server  = servers.find((s) => s.name === name);
        if (!server) return `MCP server "${name}" not found.`;

        const res = await fetch(`${getApiUrl()}/api/v1/mcp/servers/${server.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled }),
        });

        if (!res.ok) {
          return `Failed to ${sub} MCP server: ${await res.text()}`;
        }

        return `MCP server "${name}" ${sub}d.`;
      } catch (err) {
        return `Failed to ${sub} MCP server: ${(err as Error).message}`;
      }
    }

    return `Unknown subcommand "${sub}". Usage: /mcp [list | add | remove | enable | disable]`;
  },
});
