/**
 * Unit tests for planAutoTask — LLM-based task decomposition.
 * Mocks providerRegistry to test JSON parsing, DAG validation, and normalization.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock providerRegistry before importing planner ──────────────────────
const mockChat = vi.fn();

vi.mock('../providers/registry.js', () => ({
  providerRegistry: {
    getActive: () => ({
      chat: mockChat,
    }),
  },
}));

import { planAutoTask } from './planner.js';

// Default mock response
const defaultPlanResponse = {
  message: {
    content: JSON.stringify({
      objective: 'Test objective',
      reasoning: 'Break into small steps',
      estimatedSteps: 2,
      subtasks: [
        {
          id: 'step-1',
          title: 'Search for info',
          description: 'Search the web for relevant information',
          type: 'web_search',
          dependsOn: [],
          searchQuery: 'test query',
        },
        {
          id: 'step-2',
          title: 'Summarize results',
          description: 'Summarize the findings',
          type: 'sub_agent',
          dependsOn: ['step-1'],
          agentTasks: [{ role: 'researcher', prompt: 'Summarize findings' }],
        },
      ],
    }),
  },
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe('planAutoTask', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockChat.mockResolvedValue(defaultPlanResponse);
  });

  it('returns a valid AutoTaskPlan with required fields', async () => {
    const plan = await planAutoTask(
      'Research and summarize TypeScript best practices',
      1,
      'Meta-Llama-3.1-8B-Instruct-Q4_K_M',
    );

    expect(plan.objective).toBeDefined();
    expect(typeof plan.objective).toBe('string');
    expect(Array.isArray(plan.subtasks)).toBe(true);
    expect(plan.subtasks.length).toBeGreaterThan(0);
    expect(typeof plan.reasoning).toBe('string');
    expect(typeof plan.estimatedSteps).toBe('number');
  });

  it('all subtask IDs are unique', async () => {
    const plan = await planAutoTask(
      'test objective',
      1,
      'Meta-Llama-3.1-8B-Instruct-Q4_K_M',
    );
    const ids = plan.subtasks.map((s) => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('all dependsOn references point to valid subtask IDs', async () => {
    const plan = await planAutoTask(
      'test objective',
      1,
      'Meta-Llama-3.1-8B-Instruct-Q4_K_M',
    );
    const ids = new Set(plan.subtasks.map((s) => s.id));
    for (const subtask of plan.subtasks) {
      for (const dep of subtask.dependsOn) {
        expect(ids.has(dep)).toBe(true);
      }
    }
  });

  it('all subtasks start with pending status', async () => {
    const plan = await planAutoTask(
      'test objective',
      1,
      'Meta-Llama-3.1-8B-Instruct-Q4_K_M',
    );
    for (const subtask of plan.subtasks) {
      expect(subtask.status).toBe('pending');
    }
  });

  it('preserves type-specific fields (searchQuery, agentTasks)', async () => {
    const plan = await planAutoTask(
      'test objective',
      1,
      'Meta-Llama-3.1-8B-Instruct-Q4_K_M',
    );
    const searchTask = plan.subtasks.find((s) => s.type === 'web_search');
    expect(searchTask?.searchQuery).toBe('test query');

    const agentTask = plan.subtasks.find((s) => s.type === 'sub_agent');
    expect(agentTask?.agentTasks).toBeDefined();
    expect(Array.isArray(agentTask?.agentTasks)).toBe(true);
  });

  it('handles LLM output with prose wrapping the JSON (code fence)', async () => {
    const innerPlan = {
      objective: 'wrapped',
      reasoning: 'step by step',
      estimatedSteps: 1,
      subtasks: [
        {
          id: 'a',
          title: 'single step',
          description: 'do the thing',
          type: 'tool_call',
          dependsOn: [],
        },
      ],
    };
    mockChat.mockResolvedValueOnce({
      message: {
        content: `Here is the plan:\n\`\`\`json\n${JSON.stringify(innerPlan)}\n\`\`\``,
      },
    });

    const plan = await planAutoTask(
      'wrapped test',
      1,
      'Meta-Llama-3.1-8B-Instruct-Q4_K_M',
    );
    expect(plan.subtasks.length).toBe(1);
    expect(plan.objective).toBe('wrapped');
  });

  it('handles LLM output where JSON is embedded in prose text', async () => {
    const innerPlan = {
      objective: 'inline',
      reasoning: 'reason',
      estimatedSteps: 1,
      subtasks: [
        {
          id: 'b',
          title: 'inline step',
          description: 'do inline',
          type: 'web_search',
          dependsOn: [],
          searchQuery: 'inline query',
        },
      ],
    };
    mockChat.mockResolvedValueOnce({
      message: {
        content: `Sure, I'll plan this for you. ${JSON.stringify(innerPlan)} Hope that helps!`,
      },
    });

    const plan = await planAutoTask(
      'inline test',
      1,
      'Meta-Llama-3.1-8B-Instruct-Q4_K_M',
    );
    expect(plan.subtasks.length).toBe(1);
  });

  it('assigns fallback IDs when subtask.id is missing', async () => {
    mockChat.mockResolvedValueOnce({
      message: {
        content: JSON.stringify({
          objective: 'no-id test',
          reasoning: 'test',
          estimatedSteps: 1,
          subtasks: [
            { title: 'No ID step', description: 'desc', type: 'tool_call', dependsOn: [] },
          ],
        }),
      },
    });

    const plan = await planAutoTask(
      'fallback id test',
      1,
      'Meta-Llama-3.1-8B-Instruct-Q4_K_M',
    );
    expect(plan.subtasks.length).toBe(1);
    expect(typeof plan.subtasks[0]!.id).toBe('string');
    expect(plan.subtasks[0]!.id.length).toBeGreaterThan(0);
  });

  it('throws when the LLM returns completely invalid JSON', async () => {
    mockChat.mockResolvedValueOnce({
      message: { content: 'I cannot create a plan for that.' },
    });

    await expect(
      planAutoTask('bad llm', 1, 'Meta-Llama-3.1-8B-Instruct-Q4_K_M'),
    ).rejects.toThrow(/invalid JSON/i);
  });

  it('throws when a subtask references a non-existent dependency', async () => {
    mockChat.mockResolvedValueOnce({
      message: {
        content: JSON.stringify({
          objective: 'bad dag',
          reasoning: 'test',
          estimatedSteps: 1,
          subtasks: [
            {
              id: 'c',
              title: 'broken dep',
              description: 'depends on ghost',
              type: 'tool_call',
              dependsOn: ['nonexistent-id'],
            },
          ],
        }),
      },
    });

    await expect(
      planAutoTask('bad dag', 1, 'Meta-Llama-3.1-8B-Instruct-Q4_K_M'),
    ).rejects.toThrow(/invalid dependency/i);
  });

  it('passes the securityLevel note to the LLM prompt', async () => {
    mockChat.mockImplementationOnce(
      async (opts: { messages: Array<{ role: string; content: string }> }) => {
        const userMsg = opts.messages.find((m) => m.role === 'user');
        expect(userMsg?.content).toContain('3');
        return {
          message: {
            content: JSON.stringify({
              objective: 'security test',
              reasoning: 'r',
              estimatedSteps: 1,
              subtasks: [
                { id: 'd', title: 't', description: 'd', type: 'tool_call', dependsOn: [] },
              ],
            }),
          },
        };
      },
    );

    await planAutoTask('security test', 3, 'Meta-Llama-3.1-8B-Instruct-Q4_K_M');
  });
});
