/**
 * Provider abstraction layer.
 *
 * Every inference backend (llama.cpp, OpenAI-compatible, etc.) implements this
 * interface so the rest of the system can work with any provider transparently.
 */

export interface ChatMessage {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  images?: string[];
  tool_calls?: Array<{ function: { name: string; arguments: Record<string, unknown> } }>;
}

export interface ChatTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ChatStreamOptions {
  model: string;
  messages: ChatMessage[];
  tools?: ChatTool[];
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    num_ctx?: number;
    num_predict?: number;
  };
}

export interface ChatStreamChunk {
  model: string;
  created_at?: string;
  message: {
    role: string;
    content: string;
    tool_calls?: Array<{ function: { name: string; arguments: Record<string, unknown> } }>;
  };
  done: boolean;
  done_reason?: string;
  prompt_eval_count?: number;
  eval_count?: number;
}

export interface ModelInfo {
  name: string;
  size: number;
  modified_at: string;
}

export interface EmbeddingResult {
  embedding: number[];
}

/**
 * Core provider interface. Every backend must implement this.
 */
export interface InferenceProvider {
  /** Unique provider identifier (e.g. "llamacpp", "openai-compat") */
  readonly id: string;
  /** Human-readable provider name */
  readonly displayName: string;

  /** Stream a chat completion, yielding chunks. */
  chatStream(options: ChatStreamOptions, signal?: AbortSignal): AsyncGenerator<ChatStreamChunk>;
  /** Non-streaming chat completion. */
  chat(options: ChatStreamOptions): Promise<ChatStreamChunk>;
  /** List available models. */
  listModels(): Promise<ModelInfo[]>;
  /** Check if a specific model is available. */
  checkModel(name: string): Promise<boolean>;
  /** Generate text embedding (optional — not all providers support it). */
  embed?(text: string, model?: string): Promise<EmbeddingResult>;
  /** Test connectivity to the provider. */
  healthCheck(): Promise<boolean>;
}

/**
 * Configuration for a provider instance.
 */
export interface ProviderConfig {
  type: 'llamacpp' | 'openai-compat';
  baseUrl: string;
  apiKey?: string;
  /** Custom headers to send with every request. */
  headers?: Record<string, string>;
  /** Default model for this provider. */
  defaultModel?: string;
  /** Whether this is the currently active provider. */
  isActive?: boolean;
  /** Path to a specific GGUF model file (llamacpp provider). */
  modelPath?: string;
  /** Number of GPU layers to offload (llamacpp provider). -1 = auto. */
  gpuLayers?: number;
}
