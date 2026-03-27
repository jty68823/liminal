/**
 * Provider registry — singleton that manages all inference providers.
 *
 * Providers are registered by type. The active provider is selected based on
 * configuration (env vars or DB settings). Supports runtime switching.
 */

import type { InferenceProvider, ProviderConfig } from './types.js';
import { LlamaCppProvider } from './llamacpp.provider.js';
import { OpenAICompatProvider } from './openai-compat.provider.js';

class ProviderRegistry {
  private providers = new Map<string, InferenceProvider>();
  private activeProviderId: string = 'llamacpp';

  constructor() {
    // Auto-register the default Liminal AI (llama.cpp) provider
    this.registerDefaults();
  }

  private registerDefaults(): void {
    // Register the built-in Liminal AI provider (node-llama-cpp)
    this.register(new LlamaCppProvider());

    // Auto-register OpenAI-compat if configured
    const openaiBaseUrl = process.env['OPENAI_BASE_URL'];
    const openaiApiKey = process.env['OPENAI_API_KEY'];
    if (openaiBaseUrl) {
      this.register(
        new OpenAICompatProvider({
          baseUrl: openaiBaseUrl,
          apiKey: openaiApiKey,
          displayName: process.env['OPENAI_PROVIDER_NAME'] ?? 'OpenAI Compatible',
        }),
      );
    }

    // Set active provider from env
    const providerType = process.env['PROVIDER_TYPE'];
    if (providerType === 'openai-compat' && openaiBaseUrl) {
      this.activeProviderId = 'openai-compat';
    }
  }

  /** Register a provider instance. */
  register(provider: InferenceProvider): void {
    this.providers.set(provider.id, provider);
  }

  /** Get the currently active provider. */
  getActive(): InferenceProvider {
    const p = this.providers.get(this.activeProviderId);
    if (!p) {
      // Fallback to Liminal AI (llamacpp)
      const fallback = this.providers.get('llamacpp');
      if (!fallback) throw new Error('No inference providers registered');
      return fallback;
    }
    return p;
  }

  /** Get a specific provider by ID. */
  get(id: string): InferenceProvider | undefined {
    return this.providers.get(id);
  }

  /** Set the active provider by ID. */
  setActive(id: string): void {
    if (!this.providers.has(id)) {
      throw new Error(`Provider "${id}" is not registered`);
    }
    this.activeProviderId = id;
  }

  /** Get the active provider ID. */
  getActiveId(): string {
    return this.activeProviderId;
  }

  /** List all registered providers. */
  listAll(): Array<{ id: string; displayName: string; isActive: boolean }> {
    return Array.from(this.providers.entries()).map(([id, p]) => ({
      id,
      displayName: p.displayName,
      isActive: id === this.activeProviderId,
    }));
  }

  /**
   * Create and register a provider from config.
   */
  registerFromConfig(config: ProviderConfig): InferenceProvider {
    let provider: InferenceProvider;

    switch (config.type) {
      case 'llamacpp':
        provider = new LlamaCppProvider();
        break;
      case 'openai-compat':
        provider = new OpenAICompatProvider({
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          headers: config.headers,
        });
        break;
      default:
        throw new Error(`Unknown provider type: ${config.type}`);
    }

    this.register(provider);

    if (config.isActive) {
      this.activeProviderId = provider.id;
    }

    return provider;
  }
}

/** Singleton provider registry. */
export const providerRegistry = new ProviderRegistry();
