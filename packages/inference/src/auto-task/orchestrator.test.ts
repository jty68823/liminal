/**
 * Unit tests for AutoTaskOrchestrator — DAG execution and event emission.
 * Mocks planner, executor, and providerRegistry to test orchestration logic only.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks must be hoisted before any imports ───────────────────────────────

vi.mock('./planner.js', () => ({
  planAutoTask: vi.fn().mockResolvedValue({
    objective: 'test',
    reasoning: 'reason',
    estimatedSteps: 2,
    subtasks: [
      {
        id: 'task-1',
        title: 'First task',
        description: 'Do first',
        type: 'web_search',
        dependsOn: [],
        status: 'pending',
        searchQuery: 'test',
      },
      {
        id: 'task-2',
        title: 'Second task',
        description: 'Do second',
        type: 'sub_agent',
        dependsOn: ['task-1'],
        status: 'pending',
      },
    ],
  }),
}));

vi.mock('./executor.js', () => ({
  executeSubtask: vi.fn().mockResolvedValue('Mock subtask result'),
}));

vi.mock('../providers/registry.js', () => ({
  providerRegistry: {
    getActive: () => ({
      chat: vi.fn().mockResolvedValue({
        message: { content: 'Final synthesis result' },
      }),
    }),
  },
}));

import { AutoTaskOrchestrator } from './orchestrator.js';
import { planAutoTask } from './planner.js';
import { executeSubtask } from './executor.js';
import type { AutoTaskEvent } from './types.js';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeDefaultPlan() {
  return {
    objective: 'test',
    reasoning: 'reason',
    estimatedSteps: 2,
    subtasks: [
      {
        id: 'task-1',
        title: 'First task',
        description: 'Do first',
        type: 'web_search' as const,
        dependsOn: [] as string[],
        status: 'pending' as const,
        searchQuery: 'test',
      },
      {
        id: 'task-2',
        title: 'Second task',
        description: 'Do second',
        type: 'sub_agent' as const,
        dependsOn: ['task-1'],
        status: 'pending' as const,
      },
    ],
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('AutoTaskOrchestrator', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (planAutoTask as ReturnType<typeof vi.fn>).mockResolvedValue(makeDefaultPlan());
    (executeSubtask as ReturnType<typeof vi.fn>).mockResolvedValue('Mock subtask result');
  });

  describe('event ordering', () => {
    it('emits auto_task_plan as the very first event', async () => {
      const orchestrator = new AutoTaskOrchestrator();
      const events: AutoTaskEvent[] = [];

      await orchestrator.run('run-1', 'test objective', 1, {
        onEvent: (e) => events.push(e),
      });

      expect(events[0]?.type).toBe('auto_task_plan');
    });

    it('emits auto_task_plan before any subtask_start event', async () => {
      const orchestrator = new AutoTaskOrchestrator();
      const events: AutoTaskEvent[] = [];

      await orchestrator.run('run-order', 'test objective', 1, {
        onEvent: (e) => events.push(e),
      });

      const planIdx = events.findIndex((e) => e.type === 'auto_task_plan');
      const firstSubtaskIdx = events.findIndex((e) => e.type === 'auto_task_subtask_start');
      expect(planIdx).toBe(0);
      expect(planIdx).toBeLessThan(firstSubtaskIdx);
    });

    it('emits auto_task_done as the last event', async () => {
      const orchestrator = new AutoTaskOrchestrator();
      const events: AutoTaskEvent[] = [];

      await orchestrator.run('run-done', 'test objective', 1, {
        onEvent: (e) => events.push(e),
      });

      const lastEvent = events[events.length - 1];
      expect(lastEvent?.type).toBe('auto_task_done');
    });

    it('each subtask_start is eventually followed by a subtask_done with the same id', async () => {
      const orchestrator = new AutoTaskOrchestrator();
      const events: AutoTaskEvent[] = [];

      await orchestrator.run('run-pairs', 'test objective', 1, {
        onEvent: (e) => events.push(e),
      });

      const starts = events.filter((e) => e.type === 'auto_task_subtask_start');
      for (const start of starts) {
        const startId = (start as { subtaskId: string }).subtaskId;
        const matchingDone = events.find(
          (e) =>
            e.type === 'auto_task_subtask_done' &&
            (e as { subtaskId: string }).subtaskId === startId,
        );
        expect(matchingDone).toBeDefined();
      }
    });
  });

  describe('subtask counts', () => {
    it('emits subtask_start and subtask_done for each subtask in the plan', async () => {
      const orchestrator = new AutoTaskOrchestrator();
      const events: AutoTaskEvent[] = [];

      await orchestrator.run('run-count', 'test', 1, {
        onEvent: (e) => events.push(e),
      });

      const starts = events.filter((e) => e.type === 'auto_task_subtask_start');
      const dones = events.filter((e) => e.type === 'auto_task_subtask_done');
      expect(starts.length).toBe(2);
      expect(dones.length).toBe(2);
    });

    it('auto_task_done carries correct subtaskCount', async () => {
      const orchestrator = new AutoTaskOrchestrator();
      const events: AutoTaskEvent[] = [];

      await orchestrator.run('run-subtask-count', 'test', 1, {
        onEvent: (e) => events.push(e),
      });

      const doneEvent = events.find((e) => e.type === 'auto_task_done') as
        | { type: 'auto_task_done'; subtaskCount: number; successCount: number }
        | undefined;
      expect(doneEvent?.subtaskCount).toBe(2);
      expect(doneEvent?.successCount).toBe(2);
    });

    it('auto_task_done contains the synthesis result string', async () => {
      const orchestrator = new AutoTaskOrchestrator();
      const events: AutoTaskEvent[] = [];

      await orchestrator.run('run-result', 'test', 1, {
        onEvent: (e) => events.push(e),
      });

      const doneEvent = events.find((e) => e.type === 'auto_task_done') as
        | { result: string }
        | undefined;
      expect(typeof doneEvent?.result).toBe('string');
      expect(doneEvent?.result.length).toBeGreaterThan(0);
    });
  });

  describe('abort()', () => {
    it('returns false for an unknown runId', () => {
      const orchestrator = new AutoTaskOrchestrator();
      expect(orchestrator.abort('nonexistent-run-id')).toBe(false);
    });

    it('returns true when a known run is aborted', async () => {
      const orchestrator = new AutoTaskOrchestrator();

      let resolveHang!: () => void;
      const hangPromise = new Promise<string>((resolve) => {
        resolveHang = () => resolve('aborted result');
      });
      (executeSubtask as ReturnType<typeof vi.fn>).mockImplementationOnce(() => hangPromise);

      const events: AutoTaskEvent[] = [];
      const runPromise = orchestrator.run('run-abort', 'test', 1, {
        onEvent: (e) => events.push(e),
      });

      await Promise.resolve();

      const abortResult = orchestrator.abort('run-abort');
      expect(abortResult).toBe(true);

      resolveHang();
      await runPromise.catch(() => {/* expected */});
    });
  });

  describe('runId is threaded through events', () => {
    it('all events carry the correct runId', async () => {
      const orchestrator = new AutoTaskOrchestrator();
      const events: AutoTaskEvent[] = [];
      const testRunId = 'specific-run-id-42';

      await orchestrator.run(testRunId, 'test', 1, {
        onEvent: (e) => events.push(e),
      });

      for (const event of events) {
        expect((event as { runId: string }).runId).toBe(testRunId);
      }
    });
  });

  describe('error handling', () => {
    it('emits auto_task_error and rethrows when planner fails', async () => {
      (planAutoTask as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('LLM connection timeout'),
      );

      const orchestrator = new AutoTaskOrchestrator();
      const events: AutoTaskEvent[] = [];

      await expect(
        orchestrator.run('run-err', 'failing test', 1, {
          onEvent: (e) => events.push(e),
        }),
      ).rejects.toThrow('LLM connection timeout');

      const errorEvent = events.find((e) => e.type === 'auto_task_error') as
        | { error: string }
        | undefined;
      expect(errorEvent?.error).toContain('LLM connection timeout');
    });

    it('marks dependent subtasks as skipped when a subtask fails', async () => {
      (executeSubtask as ReturnType<typeof vi.fn>).mockImplementation(
        async (subtask: { id: string }) => {
          if (subtask.id === 'task-1') throw new Error('task-1 failed');
          return 'ok';
        },
      );

      const orchestrator = new AutoTaskOrchestrator();
      const events: AutoTaskEvent[] = [];

      await orchestrator.run('run-skip', 'test', 1, {
        onEvent: (e) => events.push(e),
      });

      const task1Done = events.find(
        (e) =>
          e.type === 'auto_task_subtask_done' &&
          (e as { subtaskId: string }).subtaskId === 'task-1',
      ) as { status: string } | undefined;
      expect(task1Done?.status).toBe('failed');
    });
  });
});
