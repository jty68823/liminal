'use client';

import { create } from 'zustand';
import type {
  AutoTaskRunStatus,
  AutoTaskPlan,
  SubtaskDisplayState,
  SecurityLevel,
  DynamicAgentInfo,
  QAResultInfo,
  QAVerdict,
  AutoTaskProgressInfo,
} from '@/types/auto-task';

/** Weight-based duration estimates (ms) per weight unit */
const WEIGHT_DURATION_MS: Record<number, number> = {
  1: 5_000,   // light: ~5s
  2: 15_000,  // medium: ~15s
  3: 45_000,  // heavy: ~45s
};

function computeProgress(subtasks: SubtaskDisplayState[], startedAt: number | null, status: AutoTaskRunStatus): AutoTaskProgressInfo {
  const total = subtasks.length;
  const completed = subtasks.filter((s) => s.status === 'completed').length;
  const failed = subtasks.filter((s) => s.status === 'failed' || s.status === 'skipped').length;
  const running = subtasks.filter((s) => s.status === 'running').length;
  const elapsedMs = startedAt ? Date.now() - startedAt : 0;

  // Weight-based progress: sum of completed weights / total weights
  const totalWeight = subtasks.reduce((sum, s) => sum + (s.weight ?? 2), 0);
  const completedWeight = subtasks
    .filter((s) => s.status === 'completed' || s.status === 'failed' || s.status === 'skipped')
    .reduce((sum, s) => sum + (s.weight ?? 2), 0);

  // Add partial credit for running tasks based on elapsed
  const runningPartialWeight = subtasks
    .filter((s) => s.status === 'running' && s.startedAt)
    .reduce((sum, s) => {
      const est = s.estimatedDurationMs ?? WEIGHT_DURATION_MS[s.weight ?? 2] ?? 15_000;
      const elapsed = Date.now() - (s.startedAt ?? Date.now());
      const fraction = Math.min(elapsed / est, 0.9); // Cap at 90%
      return sum + (s.weight ?? 2) * fraction;
    }, 0);

  const effectiveCompleted = completedWeight + runningPartialWeight;
  const progressPercent = totalWeight > 0
    ? Math.round((effectiveCompleted / totalWeight) * 100)
    : 0;

  // Estimated remaining: use velocity from completed tasks
  let estimatedRemainingMs: number | null = null;
  if (completedWeight > 0 && elapsedMs > 0) {
    const remainingWeight = totalWeight - effectiveCompleted;
    const velocity = effectiveCompleted / elapsedMs; // weight per ms
    estimatedRemainingMs = Math.round(remainingWeight / velocity);
  } else if (totalWeight > 0) {
    // Fallback: use weight-based static estimates
    const remaining = subtasks.filter((s) => s.status === 'pending' || s.status === 'running');
    estimatedRemainingMs = remaining.reduce((sum, s) => sum + (WEIGHT_DURATION_MS[s.weight ?? 2] ?? 15_000), 0);
  }

  return {
    totalSubtasks: total,
    completedSubtasks: completed,
    failedSubtasks: failed,
    runningSubtasks: running,
    progressPercent: Math.min(progressPercent, 100),
    elapsedMs,
    estimatedRemainingMs,
    phase: status,
  };
}

interface AutoTaskState {
  isOpen: boolean;
  runId: string | null;
  status: AutoTaskRunStatus;
  objective: string;
  securityLevel: SecurityLevel;
  plan: AutoTaskPlan | null;
  subtaskStatuses: SubtaskDisplayState[];
  resultText: string;
  error: string | null;
  eventLog: Array<{ type: string; timestamp: number }>;

  // Timing
  startedAt: number | null;
  totalDurationMs: number | null;
  progress: AutoTaskProgressInfo | null;

  // Dynamic agents
  dynamicAgents: DynamicAgentInfo[];

  // QA
  qaResults: QAResultInfo[];
  qaOverallVerdict: QAVerdict | null;
  qaSummary: string | null;

  setOpen: (open: boolean) => void;
  setObjective: (objective: string) => void;
  setSecurityLevel: (level: SecurityLevel) => void;
  startRun: (runId: string) => void;
  setPlan: (plan: AutoTaskPlan) => void;
  updateSubtaskStatus: (subtaskId: string, update: Partial<SubtaskDisplayState>) => void;
  refreshProgress: () => void;
  setStatus: (status: AutoTaskRunStatus) => void;
  setResult: (text: string, durationMs?: number) => void;
  setError: (error: string) => void;
  appendEvent: (type: string) => void;
  addDynamicAgent: (agent: DynamicAgentInfo) => void;
  removeDynamicAgent: (role: string) => void;
  addQAResult: (result: QAResultInfo) => void;
  setQADone: (verdict: QAVerdict, summary: string) => void;
  reset: () => void;
}

export const useAutoTaskStore = create<AutoTaskState>((set, get) => ({
  isOpen: false,
  runId: null,
  status: 'idle',
  objective: '',
  securityLevel: 1,
  plan: null,
  subtaskStatuses: [],
  resultText: '',
  error: null,
  eventLog: [],
  startedAt: null,
  totalDurationMs: null,
  progress: null,
  dynamicAgents: [],
  qaResults: [],
  qaOverallVerdict: null,
  qaSummary: null,

  setOpen: (open) => set({ isOpen: open }),
  setObjective: (objective) => set({ objective }),
  setSecurityLevel: (securityLevel) => set({ securityLevel }),
  startRun: (runId) => set({
    runId,
    status: 'planning',
    plan: null,
    subtaskStatuses: [],
    resultText: '',
    error: null,
    eventLog: [],
    startedAt: Date.now(),
    totalDurationMs: null,
    progress: null,
    dynamicAgents: [],
    qaResults: [],
    qaOverallVerdict: null,
    qaSummary: null,
  }),
  setPlan: (plan) => {
    const subtaskStatuses = plan.subtasks.map((s) => ({
      subtaskId: s.id,
      title: s.title,
      type: s.type,
      status: 'pending' as const,
      weight: s.weight ?? 2,
      estimatedDurationMs: WEIGHT_DURATION_MS[s.weight ?? 2] ?? 15_000,
    }));
    set({
      plan,
      status: 'executing',
      subtaskStatuses,
      progress: computeProgress(subtaskStatuses, get().startedAt, 'executing'),
    });
  },
  updateSubtaskStatus: (subtaskId, update) => set((state) => {
    const subtaskStatuses = state.subtaskStatuses.map((s) =>
      s.subtaskId === subtaskId ? { ...s, ...update } : s,
    );
    return {
      subtaskStatuses,
      progress: computeProgress(subtaskStatuses, state.startedAt, state.status),
    };
  }),
  refreshProgress: () => set((state) => ({
    progress: computeProgress(state.subtaskStatuses, state.startedAt, state.status),
  })),
  setStatus: (status) => set((state) => ({
    status,
    progress: computeProgress(state.subtaskStatuses, state.startedAt, status),
  })),
  setResult: (resultText, durationMs) => set({
    resultText,
    totalDurationMs: durationMs ?? null,
  }),
  setError: (error) => set({ error }),
  appendEvent: (type) => set((state) => ({
    eventLog: [...state.eventLog, { type, timestamp: Date.now() }],
  })),
  addDynamicAgent: (agent) => set((state) => ({
    dynamicAgents: [...state.dynamicAgents, agent],
  })),
  removeDynamicAgent: (role) => set((state) => ({
    dynamicAgents: state.dynamicAgents.map((a) =>
      a.role === role ? { ...a, status: 'removed' as const } : a,
    ),
  })),
  addQAResult: (result) => set((state) => ({
    qaResults: [...state.qaResults, result],
  })),
  setQADone: (verdict, summary) => set({
    qaOverallVerdict: verdict,
    qaSummary: summary,
  }),
  reset: () => set({
    runId: null,
    status: 'idle',
    objective: '',
    plan: null,
    subtaskStatuses: [],
    resultText: '',
    error: null,
    eventLog: [],
    startedAt: null,
    totalDurationMs: null,
    progress: null,
    dynamicAgents: [],
    qaResults: [],
    qaOverallVerdict: null,
    qaSummary: null,
  }),
}));
