'use client';

import { useRef, useCallback } from 'react';
import { useAutoTaskStore } from '@/store/auto-task.store';
import { useSettingsStore } from '@/store/settings.store';
import type { SecurityLevel, QAVerdict } from '@/types/auto-task';

interface AutoTaskPlanEventData {
  type: 'auto_task_plan';
  runId: string;
  plan: {
    objective: string;
    subtasks: Array<{
      id: string;
      title: string;
      description: string;
      type: 'tool_call' | 'sub_agent' | 'cowork' | 'web_search' | 'code_execution';
      dependsOn: string[];
      status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    }>;
    reasoning: string;
    estimatedSteps: number;
  };
}

interface AutoTaskSubtaskStartData {
  type: 'auto_task_subtask_start';
  subtaskId: string;
  subtask: { title: string; type: string; startedAt?: number };
}

interface AutoTaskSubtaskDoneData {
  type: 'auto_task_subtask_done';
  subtaskId: string;
  status: 'completed' | 'failed' | 'skipped';
  result?: string;
  error?: string;
  durationMs: number;
}

interface AutoTaskAgentCreatedData {
  type: 'auto_task_agent_created';
  agent: { role: string; label: string; description: string; color: string; icon: string };
}

interface AutoTaskAgentRemovedData {
  type: 'auto_task_agent_removed';
  role: string;
}

interface AutoTaskQAStartData {
  type: 'auto_task_qa_start';
  agents: string[];
}

interface AutoTaskQAResultData {
  type: 'auto_task_qa_result';
  role: string;
  verdict: QAVerdict;
  findings: string;
  score?: number;
}

interface AutoTaskQADoneData {
  type: 'auto_task_qa_done';
  overallVerdict: QAVerdict;
  summary: string;
}

interface AutoTaskDoneData {
  type: 'auto_task_done';
  result: string;
  durationMs: number;
  qaVerdict?: QAVerdict;
  qaSummary?: string;
}

interface AutoTaskErrorData {
  type: 'auto_task_error';
  error: string;
}

export function useAutoTask() {
  const eventSourceRef = useRef<EventSource | null>(null);
  const store = useAutoTaskStore();

  const start = useCallback(async (objective: string, securityLevel: SecurityLevel): Promise<void> => {
    // Read settings for the POST body
    const settings = useSettingsStore.getState().settings;
    const maxConcurrent = (settings['auto_task_max_concurrent'] as number) ?? undefined;
    const concurrencyStrategy = (settings['auto_task_concurrency_strategy'] as string) ?? undefined;
    const enableQa = (settings['auto_task_enable_qa'] as boolean) ?? undefined;

    // Create the run via POST
    const res = await fetch('/api/v1/auto-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        objective,
        security_level: securityLevel,
        ...(maxConcurrent !== undefined && { max_concurrent: maxConcurrent }),
        ...(concurrencyStrategy !== undefined && { concurrency_strategy: concurrencyStrategy }),
        ...(enableQa !== undefined && { enable_qa: enableQa }),
      }),
    });

    if (!res.ok) {
      const data = await res.json() as { error?: string };
      store.setError(data.error ?? 'Failed to create auto task');
      store.setStatus('failed');
      return;
    }

    const { run } = await res.json() as { run: { id: string } };
    store.startRun(run.id);

    // Open SSE stream
    const es = new EventSource(`/api/v1/auto-task/${run.id}/stream`);
    eventSourceRef.current = es;

    es.addEventListener('auto_task_plan', (e: MessageEvent<string>) => {
      const data = JSON.parse(e.data) as AutoTaskPlanEventData;
      store.setPlan(data.plan);
      store.appendEvent('auto_task_plan');
    });

    es.addEventListener('auto_task_subtask_start', (e: MessageEvent<string>) => {
      const data = JSON.parse(e.data) as AutoTaskSubtaskStartData;
      store.updateSubtaskStatus(data.subtaskId, {
        status: 'running',
        startedAt: data.subtask.startedAt ?? Date.now(),
      });
      store.appendEvent('auto_task_subtask_start');
    });

    es.addEventListener('auto_task_subtask_done', (e: MessageEvent<string>) => {
      const data = JSON.parse(e.data) as AutoTaskSubtaskDoneData;
      store.updateSubtaskStatus(data.subtaskId, {
        status: data.status,
        result: data.result,
        error: data.error,
        durationMs: data.durationMs,
        finishedAt: Date.now(),
      });
      store.appendEvent('auto_task_subtask_done');
    });

    // Dynamic agent lifecycle events
    es.addEventListener('auto_task_agent_created', (e: MessageEvent<string>) => {
      const data = JSON.parse(e.data) as AutoTaskAgentCreatedData;
      store.addDynamicAgent({
        role: data.agent.role,
        label: data.agent.label,
        description: data.agent.description,
        color: data.agent.color,
        icon: data.agent.icon,
        status: 'active',
        createdAt: Date.now(),
      });
      store.appendEvent('auto_task_agent_created');
    });

    es.addEventListener('auto_task_agent_removed', (e: MessageEvent<string>) => {
      const data = JSON.parse(e.data) as AutoTaskAgentRemovedData;
      store.removeDynamicAgent(data.role);
      store.appendEvent('auto_task_agent_removed');
    });

    // QA events
    es.addEventListener('auto_task_qa_start', (e: MessageEvent<string>) => {
      JSON.parse(e.data) as AutoTaskQAStartData;
      store.setStatus('qa');
      store.appendEvent('auto_task_qa_start');
    });

    es.addEventListener('auto_task_qa_result', (e: MessageEvent<string>) => {
      const data = JSON.parse(e.data) as AutoTaskQAResultData;
      store.addQAResult({
        role: data.role,
        verdict: data.verdict,
        findings: data.findings,
        score: data.score,
      });
      store.appendEvent('auto_task_qa_result');
    });

    es.addEventListener('auto_task_qa_done', (e: MessageEvent<string>) => {
      const data = JSON.parse(e.data) as AutoTaskQADoneData;
      store.setQADone(data.overallVerdict, data.summary);
      store.appendEvent('auto_task_qa_done');
    });

    es.addEventListener('auto_task_done', (e: MessageEvent<string>) => {
      const data = JSON.parse(e.data) as AutoTaskDoneData;
      store.setResult(data.result);
      store.setStatus('completed');
      store.appendEvent('auto_task_done');
      es.close();
      eventSourceRef.current = null;
    });

    es.addEventListener('auto_task_error', (e: MessageEvent<string>) => {
      const data = JSON.parse(e.data) as AutoTaskErrorData;
      store.setError(data.error);
      store.setStatus('failed');
      store.appendEvent('auto_task_error');
      es.close();
      eventSourceRef.current = null;
    });

    es.onerror = () => {
      if (store.status !== 'completed' && store.status !== 'cancelled') {
        store.setError('Connection lost');
        store.setStatus('failed');
      }
      es.close();
      eventSourceRef.current = null;
    };
  }, [store]);

  const cancel = useCallback(async (): Promise<void> => {
    const { runId } = useAutoTaskStore.getState();
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (runId) {
      await fetch(`/api/v1/auto-task/${runId}`, { method: 'DELETE' }).catch(() => {});
    }
    store.setStatus('cancelled');
  }, [store]);

  return { start, cancel };
}
