/**
 * @liminal/inference
 *
 * Public surface of the inference package. Re-exports every type and value
 * that downstream packages (UI, CLI, agents) need to interact with the
 * Liminal AI engine (node-llama-cpp).
 */

// ── Providers ────────────────────────────────────────────────────────────────
export type {
  InferenceProvider,
  ProviderConfig,
  ChatMessage,
  ChatTool,
  ChatStreamOptions,
  ChatStreamChunk,
  ProviderModelInfo,
  EmbeddingResult,
} from './providers/index.js';

export {
  LlamaCppProvider,
  OpenAICompatProvider,
  providerRegistry,
} from './providers/index.js';

// ── Liminal AI Engine (llama.cpp runtime) ─────────────────────────────────
export type { LiminalModelInfo, LlamaEngineConfig } from './llama-engine.js';
export { llamaEngine } from './llama-engine.js';

// ── Model Manager ─────────────────────────────────────────────────────────
export type { ModelDownloadProgress, ModelDownloadOptions } from './model-manager.js';
export { modelManager } from './model-manager.js';

// ── Stream parser ───────────────────────────────────────────────────────────
export type { ParsedEvent } from './stream-parser.js';
export { StreamParser } from './stream-parser.js';

// ── Model router ────────────────────────────────────────────────────────────
export type { ModelRouterConfig, SelectModelOptions } from './model-router.js';
export { ModelRouter, defaultRouter } from './model-router.js';

// ── Tool-call loop (ReAct) ──────────────────────────────────────────────────
export type {
  ToolCallLoopOptions,
  ToolCallLoopResult,
  ToolCallResultEvent,
  LoopEvent,
} from './tool-call-loop.js';

export { runToolCallLoop } from './tool-call-loop.js';

// ── Tool call validation ────────────────────────────────────────────────────
export { validateToolCall, repairToolCall, fuzzyMatchToolName } from './tool-call-validator.js';

// ── Loop strategies ─────────────────────────────────────────────────────────
export {
  LoopDetector,
  RetryStrategy,
  TokenBudget,
  summarizeToolResults,
  checkStopConditions,
} from './loop-strategies.js';

// ── Embeddings ──────────────────────────────────────────────────────────────
export { embed, embedBatch, cosineSimilarity, findTopK } from './embeddings.js';

// ── Agent dispatcher ────────────────────────────────────────────────────────
export type { SubAgentTask, SubAgentResult, SubAgentEvent, DispatchOptions } from './agent-dispatcher.js';
export { dispatchSubAgents, dispatchSubAgentsSync } from './agent-dispatcher.js';

// ── RAG Pipeline ───────────────────────────────────────────────────────────
export { ingestDocument, queryKnowledgeBase } from './rag.js';
export type { RAGQueryResult, RAGIngestResult } from './rag.js';

// ── Cowork (Multi-Agent Collaboration) ─────────────────────────────────────
export type {
  AgentRole,
  BaseAgentRole,
  AgentConfig,
  AgentMessage,
  AgentRoleDescription,
  CoworkSessionConfig,
  CoworkResult,
  DynamicAgentDefinition,
} from './cowork/index.js';
export {
  BASE_AGENT_ROLES,
  AGENT_ROLE_DESCRIPTIONS,
  AGENT_SYSTEM_PROMPTS,
  AgentRegistry,
  agentRegistry,
  CoworkSession,
  CoworkOrchestrator,
  coworkOrchestrator,
} from './cowork/index.js';

// ── Auto Task Orchestrator ──────────────────────────────────────────────────
export type {
  SecurityLevel,
  SubtaskType,
  SubtaskStatus,
  AutoTaskStatus,
  ConcurrencyStrategy,
  QAVerdict,
  Subtask,
  PlanDynamicAgent,
  AutoTaskPlan,
  AutoTaskOptions,
  AutoTaskEvent,
  AutoTaskPlanEvent,
  AutoTaskSubtaskStartEvent,
  AutoTaskSubtaskDoneEvent,
  AutoTaskConcurrencyEvent,
  AutoTaskAgentCreatedEvent,
  AutoTaskAgentRemovedEvent,
  AutoTaskQAStartEvent,
  AutoTaskQAResultEvent,
  AutoTaskQADoneEvent,
  AutoTaskDoneEvent,
  AutoTaskErrorEvent,
} from './auto-task/types.js';
export { AutoTaskOrchestrator, autoTaskOrchestrator } from './auto-task/orchestrator.js';

// ── Audio (STT / TTS) ─────────────────────────────────────────────────────
export type { TranscriptionResult, STTConfig } from './audio/stt.js';
export { transcribe, isSTTAvailable } from './audio/stt.js';

export type { SynthesisResult, TTSConfig } from './audio/tts.js';
export { synthesize, isTTSAvailable } from './audio/tts.js';

// ── Video Analysis ────────────────────────────────────────────────────────
export type { VideoAnalysisResult, VideoAnalysisOptions } from './video/frame-analyzer.js';
export { analyzeVideo, isVideoAnalysisAvailable } from './video/frame-analyzer.js';
