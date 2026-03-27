/**
 * Unit tests for runToolCallLoop
 * Tests the core ReAct agent loop logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock provider registry ────────────────────────────────────────────────
vi.mock('./providers/registry.js', () => ({
  providerRegistry: {
    getActive: vi.fn(),
  },
}));

import { providerRegistry } from './providers/registry.js';
import { runToolCallLoop } from './tool-call-loop.js';
import type { ToolCallLoopOptions } from './tool-call-loop.js';

// ── Helpers ───────────────────────────────────────────────────────────────

type MockChunk = {
  done: boolean;
  message?: { content?: string; tool_calls?: Array<{ function: { name: string; arguments: Record<string, unknown> } }> };
  prompt_eval_count?: number;
  eval_count?: number;
  done_reason?: string;
};

function makeMockProvider(chunks: MockChunk[][]) {
  let callCount = 0;
  return {
    chatStream: vi.fn(async function* () {
      const currentChunks = chunks[callCount] ?? chunks[chunks.length - 1];
      callCount++;
      for (const chunk of currentChunks) {
        yield chunk;
      }
    }),
  };
}

function makeOptions(overrides: Partial<ToolCallLoopOptions> = {}): ToolCallLoopOptions {
  return {
    model: 'Meta-Llama-3.1-8B-Instruct-Q4_K_M',
    messages: [{ role: 'user', content: 'Hello' }],
    tools: [],
    toolExecutor: vi.fn(),
    onEvent: vi.fn(),
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('runToolCallLoop', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('basic text response', () => {
    it('returns final messages on simple text response', async () => {
      const provider = makeMockProvider([[
        { done: false, message: { content: 'Hello' } },
        { done: true, prompt_eval_count: 10, eval_count: 5, done_reason: 'stop' },
      ]]);
      (providerRegistry.getActive as ReturnType<typeof vi.fn>).mockReturnValue(provider);

      const opts = makeOptions();
      const result = await runToolCallLoop(opts);

      expect(result.finalMessages).toBeDefined();
      expect(result.totalTokens).toBe(15);
    });

    it('emits token events for text content', async () => {
      const provider = makeMockProvider([[
        { done: false, message: { content: 'Hi' } },
        { done: false, message: { content: ' there' } },
        { done: true, prompt_eval_count: 5, eval_count: 3, done_reason: 'stop' },
      ]]);
      (providerRegistry.getActive as ReturnType<typeof vi.fn>).mockReturnValue(provider);

      const events: unknown[] = [];
      const opts = makeOptions({ onEvent: (e) => events.push(e) });
      await runToolCallLoop(opts);

      const tokenEvents = events.filter((e: unknown) => (e as { type: string }).type === 'token');
      expect(tokenEvents.length).toBeGreaterThan(0);
    });
  });

  describe('tool call execution', () => {
    it('executes tool calls and continues loop', async () => {
      const toolChunks: MockChunk[][] = [
        // First iteration: model calls a tool
        [
          {
            done: false,
            message: {
              tool_calls: [{ function: { name: 'bash', arguments: { command: 'ls' } } }],
            },
          },
          { done: true, prompt_eval_count: 10, eval_count: 5, done_reason: 'tool_calls' },
        ],
        // Second iteration: model responds with text
        [
          { done: false, message: { content: 'The files are: index.ts' } },
          { done: true, prompt_eval_count: 8, eval_count: 6, done_reason: 'stop' },
        ],
      ];
      const provider = makeMockProvider(toolChunks);
      (providerRegistry.getActive as ReturnType<typeof vi.fn>).mockReturnValue(provider);

      const bashTool = { name: 'bash', description: 'Run bash', input_schema: {} };
      const toolExecutor = vi.fn().mockResolvedValue({
        tool_use_id: 'bash',
        output: 'index.ts  package.json',
        is_error: false,
      });

      const opts = makeOptions({
        tools: [bashTool],
        toolExecutor,
      });

      const result = await runToolCallLoop(opts);

      expect(toolExecutor).toHaveBeenCalledWith('bash', { command: 'ls' });
      expect(result.totalTokens).toBe(29);
    });

    it('emits tool_call and tool_call_result events', async () => {
      const provider = makeMockProvider([
        [
          {
            done: false,
            message: {
              tool_calls: [{ function: { name: 'bash', arguments: { command: 'echo hi' } } }],
            },
          },
          { done: true, prompt_eval_count: 5, eval_count: 3, done_reason: 'tool_calls' },
        ],
        [
          { done: false, message: { content: 'Done' } },
          { done: true, prompt_eval_count: 5, eval_count: 3, done_reason: 'stop' },
        ],
      ]);
      (providerRegistry.getActive as ReturnType<typeof vi.fn>).mockReturnValue(provider);

      const events: unknown[] = [];
      const opts = makeOptions({
        tools: [{ name: 'bash', description: 'Bash', input_schema: {} }],
        toolExecutor: vi.fn().mockResolvedValue({ tool_use_id: 'bash', output: 'hi', is_error: false }),
        onEvent: (e) => events.push(e),
      });

      await runToolCallLoop(opts);

      const toolCallEvent = events.find((e: unknown) => (e as { type: string }).type === 'tool_call');
      const resultEvent = events.find((e: unknown) => (e as { type: string }).type === 'tool_call_result');

      expect(toolCallEvent).toBeDefined();
      expect(resultEvent).toBeDefined();
    });

    it('handles tool execution errors gracefully', async () => {
      const provider = makeMockProvider([
        [
          {
            done: false,
            message: {
              tool_calls: [{ function: { name: 'bash', arguments: { command: 'bad' } } }],
            },
          },
          { done: true, prompt_eval_count: 5, eval_count: 3, done_reason: 'tool_calls' },
        ],
        [
          { done: false, message: { content: 'I see the error' } },
          { done: true, prompt_eval_count: 5, eval_count: 3, done_reason: 'stop' },
        ],
      ]);
      (providerRegistry.getActive as ReturnType<typeof vi.fn>).mockReturnValue(provider);

      const toolExecutor = vi.fn().mockRejectedValue(new Error('Command failed'));

      const events: unknown[] = [];
      const opts = makeOptions({
        tools: [{ name: 'bash', description: 'Bash', input_schema: {} }],
        toolExecutor,
        onEvent: (e) => events.push(e),
      });

      await runToolCallLoop(opts);

      const resultEvent = events.find(
        (e: unknown) => (e as { type: string; is_error?: boolean }).type === 'tool_call_result' && (e as { is_error?: boolean }).is_error,
      );
      expect(resultEvent).toBeDefined();
    });
  });

  describe('loop control', () => {
    it('stops after maxIterations', async () => {
      // Always returns a tool call to simulate infinite loop potential
      const provider = {
        chatStream: vi.fn(async function* () {
          yield {
            done: false,
            message: {
              tool_calls: [{ function: { name: 'bash', arguments: { command: 'ls' } } }],
            },
          };
          yield { done: true, prompt_eval_count: 5, eval_count: 3, done_reason: 'tool_calls' };
        }),
      };
      (providerRegistry.getActive as ReturnType<typeof vi.fn>).mockReturnValue(provider);

      const toolExecutor = vi.fn().mockResolvedValue({
        tool_use_id: 'bash',
        output: 'files',
        is_error: false,
      });

      const opts = makeOptions({
        tools: [{ name: 'bash', description: 'Bash', input_schema: {} }],
        toolExecutor,
        maxIterations: 3,
      });

      await runToolCallLoop(opts);

      // Should have been called at most maxIterations times
      expect(provider.chatStream.mock.calls.length).toBeLessThanOrEqual(3);
    });

    it('detects and skips looping tool calls', async () => {
      const provider = makeMockProvider([
        [
          {
            done: false,
            message: {
              tool_calls: [{ function: { name: 'bash', arguments: { command: 'ls' } } }],
            },
          },
          { done: true, prompt_eval_count: 5, eval_count: 3, done_reason: 'tool_calls' },
        ],
        [
          // Same tool call again
          {
            done: false,
            message: {
              tool_calls: [{ function: { name: 'bash', arguments: { command: 'ls' } } }],
            },
          },
          { done: true, prompt_eval_count: 5, eval_count: 3, done_reason: 'tool_calls' },
        ],
        [
          // Same tool call a 3rd time — LoopDetector(maxRepeats=2) triggers here
          {
            done: false,
            message: {
              tool_calls: [{ function: { name: 'bash', arguments: { command: 'ls' } } }],
            },
          },
          { done: true, prompt_eval_count: 5, eval_count: 3, done_reason: 'tool_calls' },
        ],
        [
          { done: false, message: { content: 'I stopped' } },
          { done: true, prompt_eval_count: 5, eval_count: 3, done_reason: 'stop' },
        ],
      ]);
      (providerRegistry.getActive as ReturnType<typeof vi.fn>).mockReturnValue(provider);

      const toolExecutor = vi.fn().mockResolvedValue({
        tool_use_id: 'bash',
        output: 'files',
        is_error: false,
      });

      const events: unknown[] = [];
      const opts = makeOptions({
        tools: [{ name: 'bash', description: 'Bash', input_schema: {} }],
        toolExecutor,
        onEvent: (e) => events.push(e),
      });

      await runToolCallLoop(opts);

      // Loop detection should emit a tool_call_result with is_error on the duplicate
      const errorResults = events.filter(
        (e: unknown) =>
          (e as { type: string }).type === 'tool_call_result' &&
          (e as { is_error?: boolean }).is_error &&
          (e as { output?: string }).output?.includes('Loop detected'),
      );
      expect(errorResults.length).toBeGreaterThan(0);
    });
  });

  describe('parallel vs sequential execution', () => {
    it('runs safe tools in parallel', async () => {
      const provider = makeMockProvider([
        [
          {
            done: false,
            message: {
              tool_calls: [
                { function: { name: 'readFile', arguments: { path: 'a.ts' } } },
                { function: { name: 'readFile', arguments: { path: 'b.ts' } } },
              ],
            },
          },
          { done: true, prompt_eval_count: 5, eval_count: 3, done_reason: 'tool_calls' },
        ],
        [
          { done: false, message: { content: 'Read both files' } },
          { done: true, prompt_eval_count: 5, eval_count: 3, done_reason: 'stop' },
        ],
      ]);
      (providerRegistry.getActive as ReturnType<typeof vi.fn>).mockReturnValue(provider);

      const callOrder: number[] = [];
      let counter = 0;

      const toolExecutor = vi.fn().mockImplementation(async () => {
        const myId = counter++;
        callOrder.push(myId);
        await new Promise((r) => setTimeout(r, 10));
        return { tool_use_id: 'readFile', output: 'content', is_error: false };
      });

      const opts = makeOptions({
        tools: [{ name: 'readFile', description: 'Read file', input_schema: {} }],
        toolExecutor,
      });

      const start = Date.now();
      await runToolCallLoop(opts);
      const elapsed = Date.now() - start;

      // If run in parallel, both should complete in ~10ms (not 20ms)
      expect(toolExecutor).toHaveBeenCalledTimes(2);
    });

    it('runs dangerous tools sequentially', async () => {
      const provider = makeMockProvider([
        [
          {
            done: false,
            message: {
              tool_calls: [
                { function: { name: 'bash', arguments: { command: 'rm a' } } },
                { function: { name: 'bash', arguments: { command: 'rm b' } } },
              ],
            },
          },
          { done: true, prompt_eval_count: 5, eval_count: 3, done_reason: 'tool_calls' },
        ],
        [
          { done: false, message: { content: 'Done' } },
          { done: true, prompt_eval_count: 5, eval_count: 3, done_reason: 'stop' },
        ],
      ]);
      (providerRegistry.getActive as ReturnType<typeof vi.fn>).mockReturnValue(provider);

      const callOrder: string[] = [];
      const toolExecutor = vi.fn().mockImplementation(async (_name: string, input: Record<string, unknown>) => {
        callOrder.push(String(input['command']));
        return { tool_use_id: 'bash', output: 'ok', is_error: false };
      });

      const opts = makeOptions({
        tools: [{ name: 'bash', description: 'Bash', input_schema: {} }],
        toolExecutor,
        dangerousTools: new Set(['bash']),
      });

      await runToolCallLoop(opts);

      expect(toolExecutor).toHaveBeenCalledTimes(2);
      // Sequential: should be called in order
      expect(callOrder).toEqual(['rm a', 'rm b']);
    });
  });
});
