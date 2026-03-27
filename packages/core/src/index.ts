// Types
export type {
  MessageRole,
  ContentBlock,
  TextBlock,
  ImageBlock,
  ToolUseBlock,
  ToolResultBlock,
  Message,
  StreamEvent,
  TokenStreamEvent,
  ToolCallStartStreamEvent,
  ToolCallResultStreamEvent,
  ArtifactStreamEvent,
  DoneStreamEvent,
  ErrorStreamEvent,
} from './types/message.js';

export type { JSONSchema, ToolDefinition, ToolCall, ToolResult } from './types/tool.js';

export type { ArtifactType, Project, Conversation, Artifact } from './types/project.js';

export type { TaskType, ModelInfo } from './types/model.js';
export { KNOWN_MODELS, DEFAULT_MODELS } from './types/model.js';

// Prompts
export type { BuildSystemPromptOptions } from './prompts/base.js';
export { buildSystemPrompt } from './prompts/base.js';
export { buildToolCallingPrompt } from './prompts/tool-calling.js';
export type { ModelFamily } from './prompts/model-families.js';
export { detectModelFamily, getModelFamilyConfig } from './prompts/model-families.js';

// Context — counter
export {
  CONTEXT_LIMITS,
  getContextLimit,
  estimateTokens,
  estimateContentTokens,
  countMessageTokens,
} from './context/counter.js';

// Context — assembler
export type { AssemblerOptions, ProviderMessage, OllamaMessage } from './context/assembler.js';
export { assembleContext, toProviderMessages, toOllamaMessages } from './context/assembler.js';

// Context — truncator
export type { TruncationResult } from './context/truncator.js';
export {
  needsTruncation,
  truncateContext,
  maybetruncateContext,
} from './context/truncator.js';

// Context — summarizer
export type { SummaryResult } from './context/summarizer.js';
export {
  buildSummaryPrompt,
  scoreMessageRelevance,
  partitionForSummary,
  buildSummaryMessage,
  estimateSavings,
} from './context/summarizer.js';

// Context — working memory
export type { WorkingMemoryEntry } from './context/working-memory.js';
export { WorkingMemory } from './context/working-memory.js';

// Context — sliding window
export type { SlidingWindowConfig, SlidingWindowResult } from './context/sliding-window.js';
export { SlidingWindowManager, slidingWindowManager } from './context/sliding-window.js';

// Chunking
export type { Chunk, ChunkMetadata, SplitStrategy } from './chunking/types.js';
export { RecursiveTextSplitter } from './chunking/text-splitter.js';
export { parseDocument, parseAndChunk } from './chunking/document-parser.js';
