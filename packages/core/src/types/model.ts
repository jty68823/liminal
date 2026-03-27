/**
 * Broad capability categories used to match tasks to suitable models.
 */
export type TaskType = 'general' | 'code' | 'fast' | 'embed';

/**
 * Metadata describing a language model available through the Liminal AI engine.
 */
export interface ModelInfo {
  /** Model identifier (GGUF filename without extension). */
  name: string;
  /** Human-readable display name shown in the UI. */
  displayName: string;
  /** Maximum number of tokens the model's context window can hold. */
  contextLength: number;
  /** Whether this is the recommended model when no preference is set. */
  isDefault?: boolean;
  /** The task categories this model is well-suited for. */
  taskTypes: TaskType[];
}

/**
 * A curated set of well-known models that ship with Liminal.
 *
 * Keys are GGUF model identifiers; values carry UI and capability metadata.
 * This list is intentionally kept small — additional models are discovered
 * at runtime by scanning the models directory.
 */
export const KNOWN_MODELS: ModelInfo[] = [
  {
    name: 'Meta-Llama-3.1-8B-Instruct-Q4_K_M',
    displayName: 'Llama 3.1 8B Instruct',
    contextLength: 131072,
    isDefault: true,
    taskTypes: ['general', 'code'],
  },
  {
    name: 'Meta-Llama-3.1-8B-Instruct-Q8_0',
    displayName: 'Llama 3.1 8B Instruct (Q8)',
    contextLength: 131072,
    isDefault: false,
    taskTypes: ['general', 'code'],
  },
  {
    name: 'DeepSeek-R1-Distill-Llama-8B-Q4_K_M',
    displayName: 'DeepSeek R1 8B',
    contextLength: 65536,
    isDefault: false,
    taskTypes: ['general', 'code'],
  },
  {
    name: 'Qwen2.5-Coder-7B-Instruct-Q4_K_M',
    displayName: 'Qwen 2.5 Coder 7B',
    contextLength: 131072,
    isDefault: false,
    taskTypes: ['code'],
  },
  {
    name: 'Mistral-7B-Instruct-v0.3-Q4_K_M',
    displayName: 'Mistral 7B Instruct',
    contextLength: 32768,
    isDefault: false,
    taskTypes: ['general', 'fast'],
  },
  {
    name: 'nomic-embed-text-v1.5.Q8_0',
    displayName: 'Nomic Embed Text v1.5',
    contextLength: 8192,
    isDefault: false,
    taskTypes: ['embed'],
  },
  {
    name: 'llava-v1.6-mistral-7b.Q4_K_M',
    displayName: 'LLaVA v1.6 Mistral 7B (Vision)',
    contextLength: 32768,
    isDefault: false,
    taskTypes: ['general'],
  },
];

/**
 * The recommended model to use for each task type when the user has not
 * specified a model preference.
 */
export const DEFAULT_MODELS: Record<TaskType, string> = {
  general: 'Meta-Llama-3.1-8B-Instruct-Q4_K_M',
  code: 'Qwen2.5-Coder-7B-Instruct-Q4_K_M',
  fast: 'Meta-Llama-3.1-8B-Instruct-Q4_K_M',
  embed: 'nomic-embed-text-v1.5.Q8_0',
};
