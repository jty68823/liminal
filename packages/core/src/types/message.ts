/**
 * Represents who sent a message in a conversation.
 */
export type MessageRole = 'user' | 'assistant' | 'tool' | 'system';

/**
 * A plain text content block.
 */
export interface TextBlock {
  type: 'text';
  text: string;
}

/**
 * An image content block supporting base64-encoded or URL-referenced images.
 */
export interface ImageBlock {
  type: 'image';
  source:
    | {
        type: 'base64';
        media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
        data: string;
      }
    | {
        type: 'url';
        url: string;
      };
}

/**
 * Represents a request to call a tool.
 */
export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Represents the result returned after executing a tool.
 */
export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string | ContentBlock[];
  is_error?: boolean;
}

/**
 * Union of all supported content block types.
 */
export type ContentBlock = TextBlock | ImageBlock | ToolUseBlock | ToolResultBlock;

/**
 * A single message in a conversation.
 */
export interface Message {
  id: string;
  role: MessageRole;
  content: string | ContentBlock[];
  created_at: number;
  model?: string;
  tokens_input?: number;
  tokens_output?: number;
}

// ---------------------------------------------------------------------------
// StreamEvent discriminated union
// ---------------------------------------------------------------------------

/**
 * A streaming token delta emitted by the model.
 */
export interface TokenStreamEvent {
  type: 'token';
  delta: string;
}

/**
 * Signals that the model has begun a tool call.
 */
export interface ToolCallStartStreamEvent {
  type: 'tool_call_start';
  id: string;
  name: string;
}

/**
 * Carries the result of a completed tool call back through the stream.
 */
export interface ToolCallResultStreamEvent {
  type: 'tool_call_result';
  tool_use_id: string;
  output: string;
  is_error: boolean;
}

/**
 * Delivers a generated artifact (e.g. a code file or diagram).
 */
export interface ArtifactStreamEvent {
  type: 'artifact';
  artifact_id: string;
  artifact_type: string;
  title?: string;
  language?: string;
  content: string;
}

/**
 * Signals that the stream has completed successfully.
 */
export interface DoneStreamEvent {
  type: 'done';
  message_id: string;
  tokens_input: number;
  tokens_output: number;
}

/**
 * Signals that an error occurred during streaming.
 */
export interface ErrorStreamEvent {
  type: 'error';
  code: string;
  message: string;
}

/**
 * All possible events emitted during a streaming response.
 */
export type StreamEvent =
  | TokenStreamEvent
  | ToolCallStartStreamEvent
  | ToolCallResultStreamEvent
  | ArtifactStreamEvent
  | DoneStreamEvent
  | ErrorStreamEvent;
