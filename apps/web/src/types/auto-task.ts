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
  weight?: number;
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
  /** AI-estimated weight (1=light, 2=medium, 3=heavy) */
  weight?: number;
  /** Estimated duration based on weight */
  estimatedDurationMs?: number;
}

/** Overall progress metadata emitted by the orchestrator */
export interface AutoTaskProgressInfo {
  /** Total subtask count */
  totalSubtasks: number;
  /** Completed subtask count */
  completedSubtasks: number;
  /** Failed subtask count */
  failedSubtasks: number;
  /** Currently running subtask count */
  runningSubtasks: number;
  /** Percentage 0-100 based on weight-adjusted progress */
  progressPercent: number;
  /** Total elapsed ms since task start */
  elapsedMs: number;
  /** Estimated remaining ms (weight-based) */
  estimatedRemainingMs: number | null;
  /** Current phase label */
  phase: AutoTaskRunStatus;
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
