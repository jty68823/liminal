import type { ToolDefinition } from '@liminal/core';

export interface ToolHandler {
  definition: ToolDefinition;
  execute(input: Record<string, unknown>): Promise<string>;
}

export class ToolRegistry {
  private tools = new Map<string, ToolHandler>();

  register(handler: ToolHandler): void {
    this.tools.set(handler.definition.name, handler);
  }

  get(name: string): ToolHandler | undefined {
    return this.tools.get(name);
  }

  list(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((h) => h.definition);
  }

  listAll(): ToolHandler[] {
    return Array.from(this.tools.values());
  }
}

export const registry = new ToolRegistry();
