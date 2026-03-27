/**
 * Supported artifact content types.
 */
export type ArtifactType = 'code' | 'html' | 'react' | 'mermaid' | 'markdown' | 'svg';

/**
 * A workspace project that groups conversations and configuration.
 */
export interface Project {
  id: string;
  name: string;
  description?: string;
  /** Custom system prompt prepended to every conversation in this project. */
  system_prompt?: string;
  /** Absolute path to the project's root directory on the filesystem. */
  root_path?: string;
  created_at: number;
  updated_at: number;
  metadata?: Record<string, unknown>;
}

/**
 * A conversation thread, optionally belonging to a project.
 */
export interface Conversation {
  id: string;
  project_id?: string;
  title?: string;
  /** The model identifier used for this conversation (e.g. "llama3.2"). */
  model: string;
  created_at: number;
  updated_at: number;
  /** Short summary of the conversation, generated after it grows long. */
  summary?: string;
  metadata?: Record<string, unknown>;
}

/**
 * A discrete piece of generated content associated with a conversation.
 */
export interface Artifact {
  id: string;
  conversation_id: string;
  message_id?: string;
  type: ArtifactType;
  /** Programming language hint when type is 'code'. */
  language?: string;
  title?: string;
  content: string;
  /** Monotonically increasing version counter, starting at 1. */
  version: number;
  created_at: number;
  updated_at: number;
}
