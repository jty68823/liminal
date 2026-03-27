/**
 * Model family detection and per-family prompt adjustments.
 */

export type ModelFamily =
  | 'deepseek-r1'
  | 'deepseek-coder'
  | 'qwen'
  | 'llama'
  | 'mistral'
  | 'phi'
  | 'gemma'
  | 'llava'
  | 'unknown';

/**
 * Detects the model family from a model name/identifier.
 * Works with GGUF filenames and common model identifiers.
 */
export function detectModelFamily(modelName: string): ModelFamily {
  const lower = modelName.toLowerCase();

  if (lower.includes('deepseek-r1') || lower.includes('deepseek_r1')) return 'deepseek-r1';
  if (lower.includes('deepseek-coder') || lower.includes('deepseek-v')) return 'deepseek-coder';
  if (lower.includes('qwen')) return 'qwen';
  if (lower.includes('llava')) return 'llava';
  if (lower.includes('llama')) return 'llama';
  if (lower.includes('mistral') || lower.includes('mixtral')) return 'mistral';
  if (lower.includes('phi')) return 'phi';
  if (lower.includes('gemma')) return 'gemma';

  return 'unknown';
}

/**
 * Returns model-family-specific prompt adjustments.
 */
export function getModelFamilyConfig(family: ModelFamily): {
  /** Whether the model supports native tool calling. */
  supportsNativeTools: boolean;
  /** Whether the model uses <think> blocks for reasoning. */
  usesThinkingBlocks: boolean;
  /** Whether to include chain-of-thought instructions. */
  includeCoT: boolean;
  /** Whether to include explicit tool-call format instructions. */
  includeToolFormat: boolean;
  /** Whether the model supports image/vision input. */
  supportsVision: boolean;
  /** Additional system prompt suffix for this model family. */
  systemPromptSuffix: string;
} {
  switch (family) {
    case 'deepseek-r1':
      return {
        supportsNativeTools: false,
        usesThinkingBlocks: true,
        includeCoT: false, // Already has built-in CoT via <think>
        includeToolFormat: true,
        supportsVision: false,
        systemPromptSuffix: '\n\nWhen you need to use a tool, wrap your tool call in <tool_call> tags like this:\n<tool_call>\n{"name": "tool_name", "arguments": {"param": "value"}}\n</tool_call>\nAlways think step-by-step before using tools.',
      };

    case 'qwen':
      return {
        supportsNativeTools: true,
        usesThinkingBlocks: false,
        includeCoT: true,
        includeToolFormat: false,
        supportsVision: false,
        systemPromptSuffix: '\n\nThink carefully before acting. Break complex tasks into steps.',
      };

    case 'llama':
      return {
        supportsNativeTools: true,
        usesThinkingBlocks: false,
        includeCoT: true,
        includeToolFormat: false,
        supportsVision: false,
        systemPromptSuffix: '\n\nApproach tasks methodically. Use tools when needed to gather information or take actions.',
      };

    case 'mistral':
      return {
        supportsNativeTools: true,
        usesThinkingBlocks: false,
        includeCoT: true,
        includeToolFormat: false,
        supportsVision: false,
        systemPromptSuffix: '',
      };

    case 'llava':
      return {
        supportsNativeTools: false,
        usesThinkingBlocks: false,
        includeCoT: false,
        includeToolFormat: true,
        supportsVision: true,
        systemPromptSuffix: '\n\nYou can analyze images provided by the user. Describe what you see in detail.',
      };

    default:
      return {
        supportsNativeTools: false,
        usesThinkingBlocks: false,
        includeCoT: true,
        includeToolFormat: true,
        supportsVision: false,
        systemPromptSuffix: '\n\nWhen you need to use a tool, wrap your tool call in <tool_call> tags like this:\n<tool_call>\n{"name": "tool_name", "arguments": {"param": "value"}}\n</tool_call>',
      };
  }
}
