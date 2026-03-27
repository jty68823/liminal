/**
 * Text embedding utilities backed by the Liminal AI engine (node-llama-cpp).
 *
 * By default uses a compact but high-quality embedding model (GGUF format)
 * that runs well on consumer hardware.
 *
 * All functions return `Float32Array` so callers can perform efficient
 * cosine similarity comparisons without boxing overhead.
 */

import { llamaEngine } from './llama-engine.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_EMBED_MODEL = 'nomic-embed-text-v1.5.Q8_0';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Embeds a single string using the configured embedding model.
 *
 * @param text      The text to embed.
 * @param _unused   Unused parameter (kept for backward compatibility).
 * @param model     Embedding model name. Defaults to LIMINAL_EMBED_MODEL env
 *                  var or `nomic-embed-text-v1.5.Q8_0`.
 * @returns         A `Float32Array` of embedding values.
 */
export async function embed(
  text: string,
  _unused?: string,
  model?: string,
): Promise<Float32Array> {
  const resolvedModel = model ?? process.env['LIMINAL_EMBED_MODEL'] ?? DEFAULT_EMBED_MODEL;

  try {
    const embeddingCtx = await llamaEngine.getEmbeddingContext(resolvedModel);
    const ctxTyped = embeddingCtx as {
      getEmbeddingFor: (text: string) => Promise<{ vector: number[] }>;
    };

    const result = await ctxTyped.getEmbeddingFor(text);
    return new Float32Array(result.vector);
  } catch (err) {
    // If the embedding model is not available, throw a descriptive error
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Embedding failed with model "${resolvedModel}": ${msg}. ` +
      `Ensure the model file exists in the models directory.`,
    );
  }
}

/**
 * Embeds multiple strings sequentially (sharing the same embedding context).
 *
 * @param texts     Strings to embed.
 * @param _unused   Unused parameter (kept for backward compatibility).
 * @param model     Embedding model name.
 * @returns         An array of `Float32Array`, one per input text, in the
 *                  same order as `texts`.
 */
export async function embedBatch(
  texts: string[],
  _unused?: string,
  model?: string,
): Promise<Float32Array[]> {
  const resolvedModel = model ?? process.env['LIMINAL_EMBED_MODEL'] ?? DEFAULT_EMBED_MODEL;

  // Get the shared embedding context once
  const embeddingCtx = await llamaEngine.getEmbeddingContext(resolvedModel);
  const ctxTyped = embeddingCtx as {
    getEmbeddingFor: (text: string) => Promise<{ vector: number[] }>;
  };

  const results: Float32Array[] = [];
  for (const text of texts) {
    const result = await ctxTyped.getEmbeddingFor(text);
    results.push(new Float32Array(result.vector));
  }

  return results;
}

/**
 * Computes the cosine similarity between two embedding vectors.
 *
 * Returns a value in [-1, 1], where 1 means identical direction, 0 means
 * orthogonal, and -1 means opposite.
 *
 * Both vectors must have the same dimension; if either has zero magnitude
 * the function returns 0.
 *
 * @param a First embedding vector.
 * @param b Second embedding vector.
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new RangeError(
      `cosineSimilarity: vectors must have equal length (got ${a.length} vs ${b.length})`,
    );
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;

  return dot / denom;
}

/**
 * Finds the top-k most similar entries in `corpus` to `query`.
 *
 * @param query   Embedding of the query text.
 * @param corpus  Array of `{ embedding, …metadata }` objects.
 * @param k       Number of results to return.  Defaults to 5.
 * @returns       The top-k entries sorted by descending similarity, each
 *                annotated with a `score` field.
 */
export function findTopK<T extends { embedding: Float32Array }>(
  query: Float32Array,
  corpus: T[],
  k = 5,
): Array<T & { score: number }> {
  const scored = corpus.map((entry) => ({
    ...entry,
    score: cosineSimilarity(query, entry.embedding),
  }));

  scored.sort((x, y) => y.score - x.score);
  return scored.slice(0, k);
}
