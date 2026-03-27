import type { Message, ContentBlock } from '../types/message.js';

/**
 * Known context window sizes (in tokens) for common GGUF models.
 *
 * These values are used when a model's context length is not available
 * from the inference provider at runtime.
 */
export const CONTEXT_LIMITS: Record<string, number> = {
  // Llama 3 family (GGUF)
  'Meta-Llama-3.2-3B-Instruct-Q4_K_M': 131072,
  'Meta-Llama-3.2-1B-Instruct-Q4_K_M': 131072,
  'Meta-Llama-3.1-8B-Instruct-Q4_K_M': 131072,
  'Meta-Llama-3.1-70B-Instruct-Q4_K_M': 131072,
  'Meta-Llama-3-8B-Instruct-Q4_K_M': 8192,
  'Meta-Llama-3-70B-Instruct-Q4_K_M': 8192,

  // Qwen family (GGUF)
  'Qwen2.5-7B-Instruct-Q4_K_M': 131072,
  'Qwen2.5-14B-Instruct-Q4_K_M': 131072,
  'Qwen2.5-32B-Instruct-Q4_K_M': 131072,
  'Qwen2.5-Coder-7B-Instruct-Q4_K_M': 131072,
  'Qwen2.5-Coder-14B-Instruct-Q4_K_M': 131072,
  'Qwen2.5-Coder-32B-Instruct-Q4_K_M': 131072,

  // Mistral family (GGUF)
  'Mistral-7B-Instruct-v0.3-Q4_K_M': 32768,
  'Mistral-Nemo-Instruct-2407-Q4_K_M': 131072,
  'Mixtral-8x7B-Instruct-v0.1-Q4_K_M': 32768,

  // DeepSeek (GGUF)
  'DeepSeek-R1-Distill-Llama-8B-Q4_K_M': 65536,
  'DeepSeek-R1-Distill-Qwen-14B-Q4_K_M': 65536,
  'DeepSeek-R1-Distill-Qwen-32B-Q4_K_M': 65536,

  // Phi family (GGUF)
  'Phi-4-Q4_K_M': 16384,
  'Phi-3-mini-4k-instruct-Q4_K_M': 131072,
  'Phi-3.5-mini-instruct-Q4_K_M': 131072,

  // Gemma family (GGUF)
  'gemma-2-9b-it-Q4_K_M': 8192,
  'gemma-2-27b-it-Q4_K_M': 8192,

  // Embedding models (GGUF)
  'nomic-embed-text-v1.5-Q4_K_M': 8192,

  // Legacy model identifier aliases (backward compatibility)
  'llama3.2:latest': 131072,
  'llama3.2:3b': 131072,
  'llama3.2:1b': 131072,
  'llama3.1:latest': 131072,
  'llama3.1:8b': 131072,
  'llama3.1:70b': 131072,
  'llama3:latest': 8192,
  'llama3:8b': 8192,
  'llama3:70b': 8192,
  'qwen2.5:latest': 131072,
  'qwen2.5:7b': 131072,
  'qwen2.5:14b': 131072,
  'qwen2.5:32b': 131072,
  'qwen2.5-coder:latest': 131072,
  'qwen2.5-coder:7b': 131072,
  'qwen2.5-coder:14b': 131072,
  'qwen2.5-coder:32b': 131072,
  'mistral:latest': 32768,
  'mistral:7b': 32768,
  'mistral-nemo:latest': 131072,
  'mixtral:latest': 32768,
  'mixtral:8x7b': 32768,
  'deepseek-r1:7b': 65536,
  'deepseek-r1:14b': 65536,
  'deepseek-r1:32b': 65536,
  'deepseek-r1:70b': 65536,
  'deepseek-coder-v2:latest': 131072,
  'phi4:latest': 16384,
  'phi3:latest': 131072,
  'phi3.5:latest': 131072,
  'gemma2:latest': 8192,
  'gemma2:9b': 8192,
  'gemma2:27b': 8192,
  'nomic-embed-text:latest': 8192,
  'mxbai-embed-large:latest': 512,
  'all-minilm:latest': 512,

  // Catch-all fallback
  default: 8192,
};

/**
 * Returns the context limit for a model, falling back to a safe default if
 * the model is not in the known-models table.
 */
export function getContextLimit(modelName: string): number {
  return CONTEXT_LIMITS[modelName] ?? CONTEXT_LIMITS['default'] ?? 8192;
}

/**
 * Estimates the token count for a string using the common rule-of-thumb that
 * 1 token ≈ 4 characters. This is intentionally an over-estimate so that
 * truncation decisions err on the side of caution.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Estimates the number of tokens consumed by a single content block.
 */
function estimateBlockTokens(block: ContentBlock): number {
  switch (block.type) {
    case 'text':
      return estimateTokens(block.text);
    case 'image':
      // Images consume a significant but roughly fixed token budget in vision models.
      return 1024;
    case 'tool_use':
      return (
        estimateTokens(block.name) +
        estimateTokens(JSON.stringify(block.input)) +
        8 // overhead for structural tokens
      );
    case 'tool_result': {
      const contentCost =
        typeof block.content === 'string'
          ? estimateTokens(block.content)
          : block.content.reduce((acc, b) => acc + estimateBlockTokens(b), 0);
      return contentCost + 4;
    }
    default:
      return 0;
  }
}

/**
 * Estimates the total tokens consumed by the content field of a message,
 * whether it is a plain string or an array of content blocks.
 */
export function estimateContentTokens(content: Message['content']): number {
  if (typeof content === 'string') {
    return estimateTokens(content);
  }
  return content.reduce((acc, block) => acc + estimateBlockTokens(block), 0);
}

/**
 * Estimates the combined token count for an array of messages.
 *
 * In addition to the content tokens, a small fixed overhead per message is
 * added to approximate the role / structural tokens used by the inference API.
 */
export function countMessageTokens(messages: Message[]): number {
  const MESSAGE_OVERHEAD = 4; // role label + delimiters
  return messages.reduce(
    (total, msg) => total + estimateContentTokens(msg.content) + MESSAGE_OVERHEAD,
    0,
  );
}
