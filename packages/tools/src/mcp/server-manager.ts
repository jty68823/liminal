import { McpClient } from './client.js';
import { registry } from '../registry.js';
import { getDb } from '@liminal/db';
import { mcpServers, eq } from '@liminal/db';

export class McpServerManager {
  private clients = new Map<string, McpClient>();

  async start(serverId: string, command: string, args: string[]): Promise<McpClient> {
    const client = new McpClient(serverId, command, args);
    await client.connect();
    this.clients.set(serverId, client);
    // Register all MCP tools with the tool registry
    const tools = await client.listTools();
    for (const tool of tools) {
      const toolName = `mcp__${serverId}__${tool.name}`;
      registry.register({
        definition: {
          name: toolName,
          description: tool.description ?? `MCP tool: ${tool.name} (server: ${serverId})`,
          input_schema: (tool.inputSchema as Record<string, unknown>) ?? { type: 'object', properties: {} },
        },
        async execute(input) {
          return client.callTool(tool.name, input);
        },
      });
    }
    return client;
  }

  get(serverId: string): McpClient | undefined {
    return this.clients.get(serverId);
  }

  async stop(serverId: string): Promise<void> {
    const client = this.clients.get(serverId);
    if (client) {
      await client.disconnect();
      this.clients.delete(serverId);
    }
  }

  async stopAll(): Promise<void> {
    for (const id of [...this.clients.keys()]) {
      await this.stop(id);
    }
  }

  async loadFromDb(): Promise<void> {
    try {
      const db = getDb();
      const servers = db.select().from(mcpServers).where(eq(mcpServers.enabled, 1)).all();
      for (const s of servers) {
        const args = s.args ? (JSON.parse(s.args) as string[]) : [];
        try {
          await this.start(s.id, s.command, args);
          console.log(`[mcp] Started server: ${s.name}`);
        } catch (err) {
          console.error(`[mcp] Failed to start server ${s.name}:`, err);
        }
      }
    } catch (err) {
      console.error('[mcp] loadFromDb error:', err);
    }
  }

  list(): Array<{ id: string; connected: boolean }> {
    return [...this.clients.entries()].map(([id]) => ({ id, connected: true }));
  }
}

export const mcpManager = new McpServerManager();
