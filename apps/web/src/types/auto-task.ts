/**
 * Auto Task frontend types — mirrors backend types without Node.js imports.
 */

export type SecurityLevel = 1 | 2 | 3;

export type SubtaskType =
  | 'tool_call'
  | 'sub_agent'
  | 'cowork'
  | 'web_search'
  | 'code_execution';

export type SubtaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export type AutoTaskRunStatus =
  | 'idle'
  | 'pending'
  | 'planning'
  | 'executing'
  | 'qa'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type QAVerdict = 'pass' | 'fail' | 'warning';

export interface Subtask {
  id: string;
  title: string;
  description: string;
  type: SubtaskType;
  dependsOn: string[];
  status: SubtaskStatus;
  result?: string;
  error?: string;
  startedAt?: number;
  finishedAt?: number;
}

export interface AutoTaskPlan {
  objective: string;
  subtasks: Subtask[];
  reasoning: string;
  estimatedSteps: number;
}

export interface SubtaskDisplayState {
  subtaskId: string;
  title: string;
  type: SubtaskType;
  status: SubtaskStatus;
  result?: string;
  error?: string;
  startedAt?: number;
  finishedAt?: number;
  durationMs?: number;
}

export interface DynamicAgentInfo {
  role: string;
  label: string;
  description: string;
  color: string;
  icon: string;
  status: 'active' | 'removed';
  createdAt: number;
}

export interface QAResultInfo {
  role: string;
  verdict: QAVerdict;
  findings: string;
  score?: number;
}
