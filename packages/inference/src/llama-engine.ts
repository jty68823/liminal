/**
 * LlamaEngine — Singleton that manages the llama.cpp runtime via node-llama-cpp.
 *
 * Key design decisions:
 * - **Lazy initialization**: The native llama.cpp addon is loaded on first use,
 *   not at import time. This keeps startup fast.
 * - **Model pool**: Loaded models are cached in a Map. Unused models are
 *   automatically unloaded after a configurable timeout (default 10 min).
 * - **Context pool**: LlamaContext instances are reused across requests to
 *   avoid the overhead of creating a new context for every chat turn.
 * - **Embedding context sharing**: A single LlamaEmbeddingContext per embedding
 *   model is created and reused.
 * - **GPU auto-detection**: node-llama-cpp automatically detects CUDA/Metal/Vulkan.
 */

import path from 'path';
import fs from 'fs';

// ---------------------------------------------------------------------------
// Types (defined locally to avoid top-level import of node-llama-cpp)
// ---------------------------------------------------------------------------

/** Minimal model metadata derived from GGUF file headers. */
export interface LiminalModelInfo {
  /** GGUF filename without directory (e.g. "Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf") */
  name: string;
  /** Absolute path on disk */
  path: string;
  /** File size in bytes */
  size: number;
  /** Last modified ISO timestamp */
  modifiedAt: string;
  /** Whether the model is currently loaded in memory */
  loaded: boolean;
}

export interface LlamaEngineConfig {
  /** Directory containing .gguf model files. Defaults to LIMINAL_MODELS_DIR or ./data/models. */
  modelsDir: string;
  /** Number of GPU layers to offload. -1 = auto (all that fit). */
  gpuLayers: number;
  /** Idle timeout in ms before a model is unloaded. Default 600_000 (10 min). */
  idleTimeoutMs: number;
}

const DEFAULT_CONFIG: LlamaEngineConfig = {
  modelsDir: process.env['LIMINAL_MODELS_DIR'] ?? './data/models',
  gpuLayers: parseInt(process.env['LIMINAL_GPU_LAYERS'] ?? '-1', 10),
  idleTimeoutMs: 600_000,
};

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

class LlamaEngine {
  private config: LlamaEngineConfig;

  // Lazy-loaded native runtime
  private _llama: unknown | null = null;

  // Loaded models keyed by model name (filename without .gguf)
  private models = new Map<string, unknown>();

  // Chat contexts keyed by model name
  private contexts = new Map<string, unknown>();

  // Embedding contexts keyed by model name
  private embeddingContexts = new Map<string, unknown>();

  // Idle timers per model for auto-unload
  private idleTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(config: Partial<LlamaEngineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ── Initialization ────────────────────────────────────────────────────────

  /**
   * Lazily initializes the llama.cpp runtime. The `node-llama-cpp` package
   * is dynamically imported to avoid loading native addons at require time.
   */
  async ensureInitialized(): Promise<unknown> {
    if (this._llama) return this._llama;

    const { getLlama } = await import('node-llama-cpp');
    this._llama = await getLlama({
      // gpu: 'auto' is the default — detects CUDA/Metal/Vulkan automatically
      gpu: 'auto',
    });
    return this._llama;
  }

  // ── Model discovery ───────────────────────────────────────────────────────

  /** Ensure the models directory exists. */
  private ensureModelsDir(): void {
    const dir = path.resolve(this.config.modelsDir);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Lists all .gguf models found in the models directory.
   */
  listModels(): LiminalModelInfo[] {
    this.ensureModelsDir();
    const dir = path.resolve(this.config.modelsDir);

    try {
      const files = fs.readdirSync(dir);
      return files
        .filter((f) => f.endsWith('.gguf'))
        .map((f) => {
          const fullPath = path.join(dir, f);
          const stat = fs.statSync(fullPath);
          const name = f.replace(/\.gguf$/, '');
          return {
            name,
            path: fullPath,
            size: stat.size,
            modifiedAt: stat.mtime.toISOString(),
            loaded: this.models.has(name),
          };
        })
        .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
    } catch {
      return [];
    }
  }

  /**
   * Resolves a model name to its full path.
   * Accepts either a bare name ("Meta-Llama-3.1-8B-Instruct.Q4_K_M")
   * or a name with .gguf extension or an absolute path.
   */
  resolveModelPath(nameOrPath: string): string | null {
    // Absolute path
    if (path.isAbsolute(nameOrPath) && fs.existsSync(nameOrPath)) {
      return nameOrPath;
    }

    // Relative to models dir
    const dir = path.resolve(this.config.modelsDir);
    const withExt = nameOrPath.endsWith('.gguf') ? nameOrPath : `${nameOrPath}.gguf`;
    const fullPath = path.join(dir, withExt);

    if (fs.existsSync(fullPath)) return fullPath;

    // Case-insensitive search
    try {
      const files = fs.readdirSync(dir);
      const match = files.find(
        (f) => f.toLowerCase() === withExt.toLowerCase(),
      );
      if (match) return path.join(dir, match);
    } catch { /* non-fatal */ }

    return null;
  }

  /**
   * Normalises a model identifier to the canonical name used as Map key.
   */
  normalizeModelName(nameOrPath: string): string {
    const base = path.basename(nameOrPath);
    return base.replace(/\.gguf$/i, '');
  }

  // ── Model loading ─────────────────────────────────────────────────────────

  /**
   * Loads a GGUF model into memory. Returns the loaded LlamaModel instance.
   * If the model is already loaded, returns the cached instance.
   */
  async loadModel(nameOrPath: string): Promise<unknown> {
    const name = this.normalizeModelName(nameOrPath);

    // Return cached model if already loaded
    if (this.models.has(name)) {
      this.touchModel(name);
      return this.models.get(name)!;
    }

    const modelPath = this.resolveModelPath(nameOrPath);
    if (!modelPath) {
      throw new Error(
        `Model not found: ${nameOrPath}. Place .gguf files in ${path.resolve(this.config.modelsDir)}`,
      );
    }

    const llama = await this.ensureInitialized();
    const llamaTyped = llama as { loadModel: (opts: { modelPath: string; gpuLayers?: number }) => Promise<unknown> };

    const gpuLayers = this.config.gpuLayers === -1 ? undefined : this.config.gpuLayers;
    const model = await llamaTyped.loadModel({
      modelPath,
      gpuLayers,
    });

    this.models.set(name, model);
    this.touchModel(name);

    console.log(`[LlamaEngine] Model loaded: ${name} (${modelPath})`);
    return model;
  }

  /**
   * Unloads a model, freeing GPU/RAM memory.
   */
  async unloadModel(nameOrPath: string): Promise<void> {
    const name = this.normalizeModelName(nameOrPath);
    const model = this.models.get(name);

    // Clean up associated contexts
    const ctx = this.contexts.get(name);
    if (ctx) {
      try {
        (ctx as { dispose?: () => void }).dispose?.();
      } catch { /* ignore */ }
      this.contexts.delete(name);
    }

    const embedCtx = this.embeddingContexts.get(name);
    if (embedCtx) {
      try {
        (embedCtx as { dispose?: () => void }).dispose?.();
      } catch { /* ignore */ }
      this.embeddingContexts.delete(name);
    }

    if (model) {
      try {
        (model as { dispose?: () => void }).dispose?.();
      } catch { /* ignore */ }
      this.models.delete(name);
    }

    const timer = this.idleTimers.get(name);
    if (timer) {
      clearTimeout(timer);
      this.idleTimers.delete(name);
    }

    console.log(`[LlamaEngine] Model unloaded: ${name}`);
  }

  /**
   * Creates (or returns cached) a LlamaContext for a loaded model.
   */
  async getContext(nameOrPath: string, contextSize?: number): Promise<unknown> {
    const name = this.normalizeModelName(nameOrPath);

    if (this.contexts.has(name)) {
      this.touchModel(name);
      return this.contexts.get(name)!;
    }

    const model = await this.loadModel(nameOrPath);
    const modelTyped = model as { createContext: (opts?: { contextSize?: number }) => Promise<unknown> };

    const ctx = await modelTyped.createContext(
      contextSize ? { contextSize } : undefined,
    );

    this.contexts.set(name, ctx);
    this.touchModel(name);
    return ctx;
  }

  /**
   * Creates (or returns cached) a LlamaEmbeddingContext for a loaded model.
   */
  async getEmbeddingContext(nameOrPath: string): Promise<unknown> {
    const name = this.normalizeModelName(nameOrPath);

    if (this.embeddingContexts.has(name)) {
      this.touchModel(name);
      return this.embeddingContexts.get(name)!;
    }

    const model = await this.loadModel(nameOrPath);
    const modelTyped = model as { createEmbeddingContext: () => Promise<unknown> };

    const ctx = await modelTyped.createEmbeddingContext();
    this.embeddingContexts.set(name, ctx);
    this.touchModel(name);
    return ctx;
  }

  /**
   * Checks if a model exists and is loadable (file is present).
   */
  checkModel(nameOrPath: string): boolean {
    return this.resolveModelPath(nameOrPath) !== null;
  }

  /**
   * Returns whether a model is currently loaded in memory.
   */
  isLoaded(nameOrPath: string): boolean {
    return this.models.has(this.normalizeModelName(nameOrPath));
  }

  // ── Idle management ───────────────────────────────────────────────────────

  /**
   * Resets the idle timer for a model. Called on every access.
   */
  private touchModel(name: string): void {
    const existing = this.idleTimers.get(name);
    if (existing) clearTimeout(existing);

    if (this.config.idleTimeoutMs > 0) {
      const timer = setTimeout(() => {
        console.log(`[LlamaEngine] Auto-unloading idle model: ${name}`);
        this.unloadModel(name).catch(() => { /* non-fatal */ });
      }, this.config.idleTimeoutMs);

      this.idleTimers.set(name, timer);
    }
  }

  // ── Configuration ─────────────────────────────────────────────────────────

  updateConfig(partial: Partial<LlamaEngineConfig>): void {
    Object.assign(this.config, partial);
  }

  getConfig(): Readonly<LlamaEngineConfig> {
    return { ...this.config };
  }

  /**
   * Shuts down the engine, unloading all models and releasing resources.
   */
  async shutdown(): Promise<void> {
    // Clear all idle timers
    for (const timer of this.idleTimers.values()) {
      clearTimeout(timer);
    }
    this.idleTimers.clear();

    // Unload all models
    const names = Array.from(this.models.keys());
    for (const name of names) {
      await this.unloadModel(name);
    }

    // Dispose llama runtime
    if (this._llama) {
      try {
        (this._llama as { dispose?: () => Promise<void> }).dispose?.();
      } catch { /* ignore */ }
      this._llama = null;
    }
  }
}

/** Singleton engine instance. */
export const llamaEngine = new LlamaEngine();
