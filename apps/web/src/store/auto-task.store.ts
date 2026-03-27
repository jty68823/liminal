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
} from '@/types/auto-task';

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
  setStatus: (status: AutoTaskRunStatus) => void;
  setResult: (text: string) => void;
  setError: (error: string) => void;
  appendEvent: (type: string) => void;
  addDynamicAgent: (agent: DynamicAgentInfo) => void;
  removeDynamicAgent: (role: string) => void;
  addQAResult: (result: QAResultInfo) => void;
  setQADone: (verdict: QAVerdict, summary: string) => void;
  reset: () => void;
}

export const useAutoTaskStore = create<AutoTaskState>((set) => ({
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
    dynamicAgents: [],
    qaResults: [],
    qaOverallVerdict: null,
    qaSummary: null,
  }),
  setPlan: (plan) => set({
    plan,
    status: 'executing',
    subtaskStatuses: plan.subtasks.map((s) => ({
      subtaskId: s.id,
      title: s.title,
      type: s.type,
      status: 'pending' as const,
    })),
  }),
  updateSubtaskStatus: (subtaskId, update) => set((state) => ({
    subtaskStatuses: state.subtaskStatuses.map((s) =>
      s.subtaskId === subtaskId ? { ...s, ...update } : s,
    ),
  })),
  setStatus: (status) => set({ status }),
  setResult: (resultText) => set({ resultText }),
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
    dynamicAgents: [],
    qaResults: [],
    qaOverallVerdict: null,
    qaSummary: null,
  }),
}));
