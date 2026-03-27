/**
 * Auto Task types — autonomous task orchestration with security levels,
 * dynamic agent lifecycle, configurable concurrency, and QA workflow.
 */

export type SecurityLevel = 1 | 2 | 3;

export type SubtaskType =
  | 'tool_call'
  | 'sub_agent'
  | 'cowork'
  | 'web_search'
  | 'code_execution';

export type SubtaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export type AutoTaskStatus =
  | 'pending'
  | 'planning'
  | 'executing'
  | 'qa'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Concurrency strategy determines how maxConcurrent is resolved:
 *  - 'fixed'  — Use the explicit maxConcurrent value (default 3)
 *  - 'auto'   — AI estimates optimal concurrency based on subtask graph
 */
export type ConcurrencyStrategy = 'fixed' | 'auto';

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
  /** AI-estimated cost weight (1=light, 2=medium, 3=heavy). Used by 'auto' strategy. */
  weight?: number;
  // Type-specific fields
  toolName?: string;
  toolInput?: Record<string, unknown>;
  agentTasks?: Array<{ role: string; prompt: string; model?: string }>;
  coworkMode?: 'pipeline' | 'parallel' | 'discussion';
  searchQuery?: string;
  code?: string;
}

// ── Dynamic agent in plan ────────────────────────────────────────────────────
export interface PlanDynamicAgent {
  /** Unique snake_case identifier (e.g. "blockchain_expert") */
  role: string;
  /** Human-readable display name */
  label: string;
  /** Short description */
  description: string;
  /** Full system prompt */
  systemPrompt: string;
  /** Hex colour for UI */
  color?: string;
  /** SVG path or emoji */
  icon?: string;
}

export interface AutoTaskPlan {
  objective: string;
  subtasks: Subtask[];
  reasoning: string;
  estimatedSteps: number;
  /** AI-recommended maxConcurrent when strategy='auto'. */
  recommendedConcurrency?: number;
  /** Dynamic agents the planner wants to create for this run. */
  dynamicAgents?: PlanDynamicAgent[];
}

export interface AutoTaskOptions {
  model?: string;
  maxConcurrent?: number;
  concurrencyStrategy?: ConcurrencyStrategy;
  /** Upper bound for concurrency when strategy='auto'. Default 5, max 10. */
  maxClamp?: number;
  /** Enable QA review phase after execution. */
  enableQA?: boolean;
  abortSignal?: AbortSignal;
  onEvent: (event: AutoTaskEvent) => void;
  onToken?: (delta: string) => void;
}

// ── SSE event payloads ───────────────────────────────────────────────────────

export interface AutoTaskPlanEvent {
  type: 'auto_task_plan';
  runId: string;
  plan: AutoTaskPlan;
}

export interface AutoTaskSubtaskStartEvent {
  type: 'auto_task_subtask_start';
  runId: string;
  subtaskId: string;
  subtask: Subtask;
}

export interface AutoTaskSubtaskDoneEvent {
  type: 'auto_task_subtask_done';
  runId: string;
  subtaskId: string;
  status: SubtaskStatus;
  result?: string;
  error?: string;
  durationMs: number;
}

export interface AutoTaskConcurrencyEvent {
  type: 'auto_task_concurrency';
  runId: string;
  maxConcurrent: number;
  strategy: ConcurrencyStrategy;
  runningCount: number;
  pendingCount: number;
}

// ── Dynamic agent lifecycle events ───────────────────────────────────────────

export interface AutoTaskAgentCreatedEvent {
  type: 'auto_task_agent_created';
  runId: string;
  agent: { role: string; label: string; description: string; color: string; icon: string };
}

export interface AutoTaskAgentRemovedEvent {
  type: 'auto_task_agent_removed';
  runId: string;
  role: string;
}

// ── QA events ────────────────────────────────────────────────────────────────

export interface AutoTaskQAStartEvent {
  type: 'auto_task_qa_start';
  runId: string;
  agents: string[];
}

export interface AutoTaskQAResultEvent {
  type: 'auto_task_qa_result';
  runId: string;
  role: string;
  verdict: QAVerdict;
  findings: string;
  score?: number;
}

export interface AutoTaskQADoneEvent {
  type: 'auto_task_qa_done';
  runId: string;
  overallVerdict: QAVerdict;
  summary: string;
}

// ── Completion events ────────────────────────────────────────────────────────

export interface AutoTaskDoneEvent {
  type: 'auto_task_done';
  runId: string;
  result: string;
  totalTokens: number;
  durationMs: number;
  subtaskCount: number;
  successCount: number;
  maxConcurrentUsed: number;
  qaVerdict?: QAVerdict;
  qaSummary?: string;
}

export interface AutoTaskErrorEvent {
  type: 'auto_task_error';
  runId: string;
  error: string;
  subtaskId?: string;
}

export type AutoTaskEvent =
  | AutoTaskPlanEvent
  | AutoTaskSubtaskStartEvent
  | AutoTaskSubtaskDoneEvent
  | AutoTaskConcurrencyEvent
  | AutoTaskAgentCreatedEvent
  | AutoTaskAgentRemovedEvent
  | AutoTaskQAStartEvent
  | AutoTaskQAResultEvent
  | AutoTaskQADoneEvent
  | AutoTaskDoneEvent
  | AutoTaskErrorEvent;
