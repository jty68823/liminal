import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export interface McpToolDef {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export class McpClient {
  private client: Client;
  private transport: StdioClientTransport;

  constructor(public readonly serverId: string, command: string, args: string[]) {
    this.transport = new StdioClientTransport({ command, args });
    this.client = new Client({ name: 'liminal', version: '0.1.0' }, { capabilities: {} });
  }

  async connect(): Promise<void> {
    await this.client.connect(this.transport);
  }

  async listTools(): Promise<McpToolDef[]> {
    const result = await this.client.listTools();
    return result.tools as McpToolDef[];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    const result = await this.client.callTool({ name, arguments: args });
    const content = result.content as Array<{ type: string; text?: string }>;
    return content.map(b => b.text ?? JSON.stringify(b)).join('\n');
  }

  async disconnect(): Promise<void> {
    try {
      await this.transport.close();
    } catch { /* ignore */ }
  }
}
