/**
 * Model manager — handles GGUF model discovery, download, and metadata.
 *
 * Provides a high-level API for:
 * - Discovering models in the local models directory
 * - Downloading models from Hugging Face Hub
 * - Reading GGUF file metadata (quantization, context length, etc.)
 */

import path from 'path';
import fs from 'fs';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { llamaEngine, type LiminalModelInfo } from './llama-engine.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModelDownloadProgress {
  model: string;
  downloadedBytes: number;
  totalBytes: number;
  percent: number;
}

export interface ModelDownloadOptions {
  /** Hugging Face repo ID (e.g. "TheBloke/Llama-2-7B-Chat-GGUF") */
  repoId: string;
  /** Filename within the repo (e.g. "llama-2-7b-chat.Q4_K_M.gguf") */
  filename: string;
  /** Progress callback */
  onProgress?: (progress: ModelDownloadProgress) => void;
  /** Abort signal */
  signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// Manager
// ---------------------------------------------------------------------------

class ModelManager {
  /**
   * Lists all available models with enriched metadata.
   */
  listModels(): LiminalModelInfo[] {
    return llamaEngine.listModels();
  }

  /**
   * Checks if a specific model is available locally.
   */
  hasModel(name: string): boolean {
    return llamaEngine.checkModel(name);
  }

  /**
   * Gets the full path for a model.
   */
  getModelPath(name: string): string | null {
    return llamaEngine.resolveModelPath(name);
  }

  /**
   * Downloads a GGUF model from Hugging Face Hub.
   *
   * Files are downloaded to the configured models directory.
   */
  async downloadModel(options: ModelDownloadOptions): Promise<string> {
    const { repoId, filename, onProgress, signal } = options;
    const config = llamaEngine.getConfig();
    const modelsDir = path.resolve(config.modelsDir);

    // Ensure models directory exists
    if (!fs.existsSync(modelsDir)) {
      fs.mkdirSync(modelsDir, { recursive: true });
    }

    const outputPath = path.join(modelsDir, filename);

    // Skip if already downloaded
    if (fs.existsSync(outputPath)) {
      console.log(`[ModelManager] Model already exists: ${outputPath}`);
      return outputPath;
    }

    // Download from Hugging Face
    const url = `https://huggingface.co/${repoId}/resolve/main/${filename}`;
    console.log(`[ModelManager] Downloading: ${url}`);

    const response = await fetch(url, { signal });

    if (!response.ok) {
      throw new Error(`Download failed: HTTP ${response.status} ${response.statusText}`);
    }

    const totalBytes = parseInt(response.headers.get('content-length') ?? '0', 10);
    let downloadedBytes = 0;

    // Create a transform stream to track progress
    const body = response.body;
    if (!body) throw new Error('No response body');

    const tempPath = `${outputPath}.download`;
    const writeStream = createWriteStream(tempPath);

    try {
      const reader = body.getReader();
      const nodeStream = new Readable({
        async read() {
          const { done, value } = await reader.read();
          if (done) {
            this.push(null);
            return;
          }
          downloadedBytes += value.byteLength;
          onProgress?.({
            model: filename,
            downloadedBytes,
            totalBytes,
            percent: totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0,
          });
          this.push(Buffer.from(value));
        },
      });

      await pipeline(nodeStream, writeStream);

      // Rename temp file to final path
      fs.renameSync(tempPath, outputPath);
      console.log(`[ModelManager] Download complete: ${outputPath}`);

      return outputPath;
    } catch (err) {
      // Clean up temp file on error
      try {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      } catch { /* ignore */ }
      throw err;
    }
  }

  /**
   * Deletes a model file from disk.
   */
  async deleteModel(name: string): Promise<boolean> {
    // Unload from engine first
    if (llamaEngine.isLoaded(name)) {
      await llamaEngine.unloadModel(name);
    }

    const modelPath = llamaEngine.resolveModelPath(name);
    if (!modelPath) return false;

    try {
      fs.unlinkSync(modelPath);
      console.log(`[ModelManager] Deleted: ${modelPath}`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get human-readable size string.
   */
  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  /**
   * Suggests recommended models for first-time setup.
   */
  getRecommendedModels(): Array<{
    name: string;
    repoId: string;
    filename: string;
    description: string;
    sizeGB: number;
  }> {
    return [
      {
        name: 'Llama 3.1 8B Instruct (Q4_K_M)',
        repoId: 'bartowski/Meta-Llama-3.1-8B-Instruct-GGUF',
        filename: 'Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf',
        description: 'General-purpose instruction model. Good balance of quality and speed.',
        sizeGB: 4.9,
      },
      {
        name: 'DeepSeek R1 8B (Q4_K_M)',
        repoId: 'bartowski/DeepSeek-R1-Distill-Llama-8B-GGUF',
        filename: 'DeepSeek-R1-Distill-Llama-8B-Q4_K_M.gguf',
        description: 'Reasoning model with chain-of-thought. Great for coding tasks.',
        sizeGB: 4.9,
      },
      {
        name: 'Qwen 2.5 Coder 7B (Q4_K_M)',
        repoId: 'bartowski/Qwen2.5-Coder-7B-Instruct-GGUF',
        filename: 'Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf',
        description: 'Specialized coding model with native function calling.',
        sizeGB: 4.7,
      },
      {
        name: 'Nomic Embed Text v1.5 (Q8_0)',
        repoId: 'nomic-ai/nomic-embed-text-v1.5-GGUF',
        filename: 'nomic-embed-text-v1.5.Q8_0.gguf',
        description: 'Text embedding model for memory and RAG. Small and fast.',
        sizeGB: 0.14,
      },
    ];
  }
}

/** Singleton model manager. */
export const modelManager = new ModelManager();
