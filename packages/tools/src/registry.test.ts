import { describe, it, expect, beforeEach } from 'vitest';
import { ToolRegistry } from './registry.js';

/**
 * Create a mock tool handler for testing.
 */
function createMockHandler(name: string, description = 'A test tool') {
  return {
    definition: {
      name,
      description,
      input_schema: { type: 'object' as const, properties: {} },
    },
    execute: async (_input: Record<string, unknown>) => 'result',
  };
}

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe('register and get', () => {
    it('registers a tool and retrieves it by name', () => {
      const handler = createMockHandler('test_tool');
      registry.register(handler);

      const retrieved = registry.get('test_tool');
      expect(retrieved).toBeDefined();
      expect(retrieved?.definition.name).toBe('test_tool');
    });

    it('returns undefined for unknown tool', () => {
      const result = registry.get('nonexistent');
      expect(result).toBeUndefined();
    });

    it('overwrites a tool when registered with the same name', () => {
      const handler1 = createMockHandler('dup', 'first');
      const handler2 = createMockHandler('dup', 'second');

      registry.register(handler1);
      registry.register(handler2);

      const retrieved = registry.get('dup');
      expect(retrieved?.definition.description).toBe('second');
    });
  });

  describe('list', () => {
    it('returns empty array when no tools registered', () => {
      expect(registry.list()).toEqual([]);
    });

    it('returns all tool definitions', () => {
      registry.register(createMockHandler('tool_a', 'Tool A'));
      registry.register(createMockHandler('tool_b', 'Tool B'));

      const definitions = registry.list();
      expect(definitions).toHaveLength(2);

      const names = definitions.map((d) => d.name);
      expect(names).toContain('tool_a');
      expect(names).toContain('tool_b');
    });
  });

  describe('listAll', () => {
    it('returns empty array when no tools registered', () => {
      expect(registry.listAll()).toEqual([]);
    });

    it('returns all tool handlers', () => {
      const h1 = createMockHandler('tool_x');
      const h2 = createMockHandler('tool_y');

      registry.register(h1);
      registry.register(h2);

      const handlers = registry.listAll();
      expect(handlers).toHaveLength(2);

      // Each handler should have both definition and execute
      for (const handler of handlers) {
        expect(handler.definition).toBeDefined();
        expect(typeof handler.execute).toBe('function');
      }
    });
  });

  describe('execute', () => {
    it('executes a registered tool handler', async () => {
      const handler = {
        definition: {
          name: 'echo',
          description: 'Echoes input',
          input_schema: { type: 'object' as const, properties: {} },
        },
        execute: async (input: Record<string, unknown>) =>
          `echoed: ${String(input['text'] ?? '')}`,
      };

      registry.register(handler);
      const tool = registry.get('echo');
      const result = await tool?.execute({ text: 'hello' });
      expect(result).toBe('echoed: hello');
    });
  });
});
