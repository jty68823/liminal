/**
 * Unit tests for executeSubtask — dispatch logic for all subtask types.
 * Mocks agent-dispatcher and cowork orchestrator to isolate executor logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../agent-dispatcher.js', () => ({
  dispatchSubAgentsSync: vi.fn().mockResolvedValue([
    {
      role: 'researcher',
      status: 'success',
      output: 'Mock research output',
      durationMs: 100,
    },
  ]),
}));

vi.mock('../cowork/orchestrator.js', () => ({
  CoworkOrchestrator: vi.fn().mockImplementation(() => ({
    createSession: vi.fn().mockResolvedValue({
      sessionId: 'cowork-session-1',
      status: 'completed',
      messages: [
        { agentRole: 'coder', content: 'Cowork step output', sequence: 1 },
      ],
      finalOutput: 'Cowork final output',
      totalTokens: 0,
      durationMs: 150,
    }),
  })),
}));

import { executeSubtask } from './executor.js';
import { dispatchSubAgentsSync } from '../agent-dispatcher.js';
import { CoworkOrchestrator } from '../cowork/orchestrator.js';
import type { Subtask } from './types.js';
import type { SecurityContext } from './security.js';

// ── Fixtures ───────────────────────────────────────────────────────────────

const mockSecCtx: SecurityContext = { level: 1, runId: 'test-run-exec' };

const mockOptions = {
  onEvent: vi.fn(),
  model: 'Meta-Llama-3.1-8B-Instruct-Q4_K_M',
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe('executeSubtask', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (dispatchSubAgentsSync as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        role: 'researcher',
        status: 'success',
        output: 'Mock research output',
        durationMs: 100,
      },
    ]);
    (CoworkOrchestrator as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      createSession: vi.fn().mockResolvedValue({
        sessionId: 'cowork-session-1',
        status: 'completed',
        messages: [{ agentRole: 'coder', content: 'Cowork step output', sequence: 1 }],
        finalOutput: 'Cowork final output',
        totalTokens: 0,
        durationMs: 150,
      }),
    }));
    mockOptions.onEvent.mockReset();
  });

  describe('sub_agent type', () => {
    it('dispatches to dispatchSubAgentsSync and returns formatted output', async () => {
      const subtask: Subtask = {
        id: 'sub-1',
        title: 'Research',
        description: 'Research the topic',
        type: 'sub_agent',
        dependsOn: [],
        status: 'pending',
        agentTasks: [{ role: 'researcher', prompt: 'Research AI trends' }],
      };

      const result = await executeSubtask(subtask, mockSecCtx, '', mockOptions);
      expect(result).toContain('Mock research output');
    });

    it('calls dispatchSubAgentsSync once per sub_agent subtask', async () => {
      const subtask: Subtask = {
        id: 'sub-call-count',
        title: 'Research',
        description: 'Research',
        type: 'sub_agent',
        dependsOn: [],
        status: 'pending',
        agentTasks: [{ role: 'researcher', prompt: 'test' }],
      };

      await executeSubtask(subtask, mockSecCtx, '', mockOptions);
      expect(dispatchSubAgentsSync).toHaveBeenCalledTimes(1);
    });

    it('falls back to title as role when agentTasks is empty', async () => {
      const subtask: Subtask = {
        id: 'sub-fallback',
        title: 'My Custom Role',
        description: 'Fallback agent task',
        type: 'sub_agent',
        dependsOn: [],
        status: 'pending',
        agentTasks: [],
      };

      await executeSubtask(subtask, mockSecCtx, '', mockOptions);

      const callArg = (dispatchSubAgentsSync as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Array<{
        role: string;
        prompt: string;
      }>;
      expect(callArg[0]?.role).toBe('My Custom Role');
    });

    it('injects accumulated context into the agent prompt', async () => {
      const subtask: Subtask = {
        id: 'ctx-inject',
        title: 'With context',
        description: 'Use context',
        type: 'sub_agent',
        dependsOn: [],
        status: 'pending',
        agentTasks: [{ role: 'researcher', prompt: 'Base prompt text' }],
      };

      await executeSubtask(subtask, mockSecCtx, 'Previous result data here', mockOptions);

      const callArg = (dispatchSubAgentsSync as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Array<{
        prompt: string;
      }>;
      expect(callArg[0]?.prompt).toContain('Previous result data here');
    });

    it('returns empty context string when no prior context is provided', async () => {
      const subtask: Subtask = {
        id: 'no-ctx',
        title: 'No context',
        description: 'No context test',
        type: 'sub_agent',
        dependsOn: [],
        status: 'pending',
        agentTasks: [{ role: 'researcher', prompt: 'Clean prompt' }],
      };

      const result = await executeSubtask(subtask, mockSecCtx, '', mockOptions);
      expect(typeof result).toBe('string');

      const callArg = (dispatchSubAgentsSync as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Array<{
        prompt: string;
      }>;
      // With empty context there should be no context prefix in the prompt
      expect(callArg[0]?.prompt).not.toContain('이전 태스크 결과');
    });
  });

  describe('cowork type', () => {
    it('instantiates CoworkOrchestrator and calls createSession', async () => {
      const subtask: Subtask = {
        id: 'cowork-1',
        title: 'Code Review',
        description: 'Review the implementation',
        type: 'cowork',
        dependsOn: [],
        status: 'pending',
        coworkMode: 'pipeline',
        agentTasks: [{ role: 'reviewer', prompt: 'Review code quality' }],
      };

      const result = await executeSubtask(subtask, mockSecCtx, '', mockOptions);
      expect(CoworkOrchestrator).toHaveBeenCalledTimes(1);
      expect(result).toContain('Cowork final output');
    });

    it('returns finalOutput when available', async () => {
      const subtask: Subtask = {
        id: 'cowork-final',
        title: 'Collab task',
        description: 'Collab',
        type: 'cowork',
        dependsOn: [],
        status: 'pending',
      };

      const result = await executeSubtask(subtask, mockSecCtx, '', mockOptions);
      expect(result).toBe('Cowork final output');
    });

    it('falls back to message concatenation when finalOutput is null', async () => {
      (CoworkOrchestrator as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
        createSession: vi.fn().mockResolvedValue({
          sessionId: 'cowork-nofinal',
          status: 'completed',
          messages: [
            { agentRole: 'coder', content: 'Message A', sequence: 1 },
            { agentRole: 'reviewer', content: 'Message B', sequence: 2 },
          ],
          finalOutput: null,
          totalTokens: 0,
          durationMs: 50,
        }),
      }));

      const subtask: Subtask = {
        id: 'cowork-fallback',
        title: 'Collab fallback',
        description: 'Collab no final',
        type: 'cowork',
        dependsOn: [],
        status: 'pending',
      };

      const result = await executeSubtask(subtask, mockSecCtx, '', mockOptions);
      expect(result).toContain('Message A');
      expect(result).toContain('Message B');
    });
  });

  describe('web_search type', () => {
    it('returns a non-empty string describing the scheduled search', async () => {
      const subtask: Subtask = {
        id: 'search-1',
        title: 'Search TypeScript',
        description: 'Search for TypeScript best practices',
        type: 'web_search',
        dependsOn: [],
        status: 'pending',
        searchQuery: 'TypeScript best practices 2024',
      };

      const result = await executeSubtask(subtask, mockSecCtx, '', mockOptions);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('includes the searchQuery in the result', async () => {
      const subtask: Subtask = {
        id: 'search-query-check',
        title: 'Search',
        description: 'Search for something',
        type: 'web_search',
        dependsOn: [],
        status: 'pending',
        searchQuery: 'unique-search-query-string',
      };

      const result = await executeSubtask(subtask, mockSecCtx, '', mockOptions);
      expect(result).toContain('unique-search-query-string');
    });

    it('falls back to description when searchQuery is missing', async () => {
      const subtask: Subtask = {
        id: 'search-no-query',
        title: 'Search no query',
        description: 'fallback description text',
        type: 'web_search',
        dependsOn: [],
        status: 'pending',
      };

      const result = await executeSubtask(subtask, mockSecCtx, '', mockOptions);
      expect(result).toContain('fallback description text');
    });
  });

  describe('tool_call type (default)', () => {
    it('dispatches to dispatchSubAgentsSync as executor agent', async () => {
      const subtask: Subtask = {
        id: 'tool-1',
        title: 'List files',
        description: 'List all TypeScript files',
        type: 'tool_call',
        dependsOn: [],
        status: 'pending',
        toolName: 'list_files',
        toolInput: { path: '/src' },
      };

      const result = await executeSubtask(subtask, mockSecCtx, '', mockOptions);
      expect(dispatchSubAgentsSync).toHaveBeenCalledTimes(1);
      expect(result).toContain('Mock research output');
    });

    it('includes toolName in the executor prompt', async () => {
      const subtask: Subtask = {
        id: 'tool-name-check',
        title: 'Run bash',
        description: 'Execute bash command',
        type: 'tool_call',
        dependsOn: [],
        status: 'pending',
        toolName: 'bash',
        toolInput: { command: 'ls -la' },
      };

      await executeSubtask(subtask, mockSecCtx, '', mockOptions);

      const callArg = (dispatchSubAgentsSync as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Array<{
        prompt: string;
      }>;
      expect(callArg[0]?.prompt).toContain('bash');
    });
  });

  describe('security context L3 — code_execution blocked', () => {
    it('throws when a suspicious command is blocked at security level 3', async () => {
      const l3Ctx: SecurityContext = { level: 3, runId: 'run-l3' };
      const subtask: Subtask = {
        id: 'code-exec-blocked',
        title: 'Run dangerous command',
        description: 'rm -rf /tmp/data',
        type: 'code_execution',
        dependsOn: [],
        status: 'pending',
        code: 'rm -rf /tmp/data',
      };

      await expect(
        executeSubtask(subtask, l3Ctx, '', mockOptions),
      ).rejects.toThrow(/blocked by security policy/i);
    });
  });
});
