/**
 * Model router – selects the most appropriate model for a given task
 * and converts tool definitions to the provider API wire format.
 *
 * Model selection priority (highest wins):
 *   1. An explicit `taskType` is honoured first.
 *   2. `hasCode: true` selects the code model.
 *   3. `messageLength < 200` (and no special task) selects the fast model.
 *   4. Fallback is the general-purpose model.
 *
 * Supports fallback chains — when the primary model is unavailable, the
 * router tries alternatives in order.
 */

import type { ToolDefinition, TaskType } from '@liminal/core';
import type { ChatTool } from './providers/types.js';
import { providerRegistry } from './providers/registry.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface ModelRouterConfig {
  /** Model name used for general conversation. */
  defaultModel: string;
  /** Model name used when low latency matters more than quality. */
  fastModel: string;
  /** Model name used for code-heavy tasks. */
  codeModel: string;
  /** Model name used for text embeddings. */
  embedModel: string;
  /**
   * Fallback chain — ordered list of models to try when the primary is
   * unavailable. Each entry is tried in order until one succeeds.
   */
  fallbackChain?: string[];
}

const DEFAULT_CONFIG: ModelRouterConfig = {
  defaultModel: process.env['LIMINAL_DEFAULT_MODEL'] ?? 'Meta-Llama-3.1-8B-Instruct-Q4_K_M',
  fastModel:    process.env['LIMINAL_FAST_MODEL']    ?? 'Meta-Llama-3.1-8B-Instruct-Q4_K_M',
  codeModel:    process.env['LIMINAL_CODE_MODEL']    ?? 'Meta-Llama-3.1-8B-Instruct-Q4_K_M',
  embedModel:   process.env['LIMINAL_EMBED_MODEL']   ?? 'nomic-embed-text-v1.5.Q8_0',
  fallbackChain: [],
};

// ---------------------------------------------------------------------------
// Model selection options
// ---------------------------------------------------------------------------

export interface SelectModelOptions {
  /** Explicit task category.  Takes precedence over heuristics. */
  taskType?: TaskType;
  messageLength?: number;
  /** When true, the code model is preferred (unless taskType overrides). */
  hasCode?: boolean;
}

// ---------------------------------------------------------------------------
// ModelRouter class
// ---------------------------------------------------------------------------

export class ModelRouter {
  readonly config: ModelRouterConfig;

  constructor(config: Partial<ModelRouterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  selectModel(options: SelectModelOptions = {}): string {
    const { taskType, messageLength, hasCode } = options;

    if (taskType) {
      switch (taskType) {
        case 'fast':    return this.config.fastModel;
        case 'code':    return this.config.codeModel;
        case 'embed':   return this.config.embedModel;
        case 'general': return this.config.defaultModel;
      }
    }

    if (hasCode) return this.config.codeModel;
    if (messageLength !== undefined && messageLength < 200) {
      return this.config.fastModel;
    }

    return this.config.defaultModel;
  }

  /**
   * Selects a model with fallback: if the primary model is not available,
   * tries each model in the fallback chain.
   */
  async selectModelWithFallback(options: SelectModelOptions = {}): Promise<string> {
    const primary = this.selectModel(options);
    const provider = providerRegistry.getActive();

    try {
      const available = await provider.checkModel(primary);
      if (available) return primary;
    } catch {
      // check failed, try fallbacks
    }

    const chain = this.config.fallbackChain ?? [];
    for (const fallback of chain) {
      try {
        const available = await provider.checkModel(fallback);
        if (available) return fallback;
      } catch {
        continue;
      }
    }

    // Return primary anyway — the actual request will produce a better error
    return primary;
  }

  toProviderTools(toolDefs: ToolDefinition[]): ChatTool[] {
    return toolDefs.map((def) => ({
      type: 'function' as const,
      function: {
        name: def.name,
        description: def.description,
        parameters: def.input_schema as Record<string, unknown>,
      },
    }));
  }

  /** Update config at runtime (e.g. from DB settings). */
  updateConfig(partial: Partial<ModelRouterConfig>): void {
    Object.assign(this.config, partial);
  }
}

export const defaultRouter = new ModelRouter();
