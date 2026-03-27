/**
 * Cowork types — multi-agent collaboration system.
 *
 * AgentRole is a plain string so that dynamic (runtime-created) agents can
 * participate alongside the 10 permanent base roles.  Use BASE_AGENT_ROLES
 * or agentRegistry.isBaseRole() when you need the static set.
 */

// ── Base roles (permanent, cannot be removed) ────────────────────────────────
export const BASE_AGENT_ROLES = [
  'architect',
  'coder',
  'reviewer',
  'tester',
  'security',
  'researcher',
  'data_scientist',
  'devops',
  'product',
  'domain_expert',
] as const;

export type BaseAgentRole = (typeof BASE_AGENT_ROLES)[number];

/** Any agent role — one of the 10 base roles OR a dynamically created role. */
export type AgentRole = string;

// ── Dynamic agent definition ─────────────────────────────────────────────────
export interface DynamicAgentDefinition {
  /** Unique role identifier (snake_case, e.g. "blockchain_expert") */
  role: string;
  /** Human-readable display name */
  label: string;
  /** Short description of this agent's expertise */
  description: string;
  /** Full system prompt injected at inference time */
  systemPrompt: string;
  /** Hex colour for UI badges */
  color: string;
  /** SVG path or emoji for UI icon */
  icon: string;
  /** The auto-task run that created this agent (used for auto-cleanup) */
  createdByRunId?: string;
}

// ── Agent role metadata (UI display info) ────────────────────────────────────
export interface AgentRoleDescription {
  label: string;
  description: string;
  color: string;
  icon: string;
}

export const AGENT_ROLE_DESCRIPTIONS: Record<BaseAgentRole, AgentRoleDescription> = {
  architect: { label: 'Architect', description: 'Designs system architecture and reviews structure', color: '#6366f1', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3' },
  coder: { label: 'Coder', description: 'Writes and modifies code', color: '#22c55e', icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' },
  reviewer: { label: 'Reviewer', description: 'Reviews code for bugs and quality', color: '#f59e0b', icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7' },
  tester: { label: 'Tester', description: 'Writes tests and verifies correctness', color: '#06b6d4', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  security: { label: 'Security', description: 'Analyzes security vulnerabilities', color: '#ef4444', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
  researcher: { label: 'Researcher', description: 'Searches web and gathers information', color: '#8b5cf6', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
  data_scientist: { label: 'Data Scientist', description: 'ML/AI 및 데이터 분석 전문가 (박사급)', color: '#f59e0b', icon: '📊' },
  devops: { label: 'DevOps Engineer', description: 'CI/CD, 인프라, Kubernetes 전문가', color: '#10b981', icon: '⚙️' },
  product: { label: 'Product Manager', description: '제품 전략, UX, A/B 테스트 전문가', color: '#ec4899', icon: '🎯' },
  domain_expert: { label: 'Domain Expert', description: '의학/법/금융 등 도메인 특화 전문가', color: '#a78bfa', icon: '🎓' },
};

// ── Agent configuration ──────────────────────────────────────────────────────
export interface AgentConfig {
  role: AgentRole;
  model?: string;
  systemPrompt?: string;
  enabled: boolean;
}

export interface CoworkSessionConfig {
  task: string;
  agents: AgentConfig[];
  mode: 'pipeline' | 'parallel' | 'discussion';
  maxRounds?: number;
}

export interface AgentMessage {
  agentRole: AgentRole;
  content: string;
  timestamp: number;
  sequence: number;
}

export interface CoworkResult {
  sessionId: string;
  status: 'completed' | 'failed' | 'timeout';
  messages: AgentMessage[];
  finalOutput: string;
  totalTokens: number;
  durationMs: number;
}
