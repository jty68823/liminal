/**
 * RAG (Retrieval-Augmented Generation) Pipeline
 *
 * Provides document ingestion (parse → chunk → embed → store)
 * and query (embed query → search → format context).
 */

import { parseAndChunk } from '@liminal/core';

export interface RAGQueryResult {
  chunks: Array<{
    content: string;
    source: string;
    score: number;
    chunkIndex: number;
  }>;
  contextBlock: string;
}

export interface RAGIngestResult {
  documentId: string;
  chunkCount: number;
  status: 'success' | 'error';
  error?: string;
}

/**
 * Ingest a document into the knowledge base.
 * Parses, chunks, embeds, and stores in the database.
 */
export async function ingestDocument(
  buffer: Buffer,
  filename: string,
  options: {
    projectId?: string;
    chunkSize?: number;
    chunkOverlap?: number;
    embedFn: (text: string) => Promise<Float32Array>;
    createDocFn: (data: { projectId?: string; filename: string; mimeType?: string }) => { id: string };
    addChunkFn: (data: { documentId: string; content: string; embedding?: Buffer; chunkIndex: number; metadata?: string }) => void;
    updateStatusFn: (id: string, status: string, chunkCount?: number) => void;
  },
): Promise<RAGIngestResult> {
  const { projectId, embedFn, createDocFn, addChunkFn, updateStatusFn } = options;

  // Create document record
  const doc = createDocFn({ projectId, filename });

  try {
    updateStatusFn(doc.id, 'processing');

    // Parse and chunk
    const chunks = await parseAndChunk(buffer, filename, {
      chunkSize: options.chunkSize,
      chunkOverlap: options.chunkOverlap,
    });

    // Embed and store each chunk
    for (const chunk of chunks) {
      const embedding = await embedFn(chunk.content);
      const embeddingBuffer = Buffer.from(embedding.buffer, embedding.byteOffset, embedding.byteLength);

      addChunkFn({
        documentId: doc.id,
        content: chunk.content,
        embedding: embeddingBuffer,
        chunkIndex: chunk.metadata.chunkIndex,
        metadata: JSON.stringify(chunk.metadata),
      });
    }

    updateStatusFn(doc.id, 'ready', chunks.length);

    return { documentId: doc.id, chunkCount: chunks.length, status: 'success' };
  } catch (err) {
    updateStatusFn(doc.id, 'error');
    return {
      documentId: doc.id,
      chunkCount: 0,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Query the knowledge base for relevant context.
 */
export async function queryKnowledgeBase(
  query: string,
  options: {
    projectId?: string;
    k?: number;
    minScore?: number;
    embedFn: (text: string) => Promise<Float32Array>;
    searchFn: (embedding: Float32Array, opts: { projectId?: string; k?: number }) => Array<{ content: string; score: number; chunkIndex: number; metadata: string | null }>;
  },
): Promise<RAGQueryResult> {
  const { embedFn, searchFn, projectId, k = 5, minScore = 0.3 } = options;

  // Embed the query
  const queryEmbedding = await embedFn(query);

  // Search for similar chunks
  const results = searchFn(queryEmbedding, { projectId, k });

  // Filter by minimum score
  const filtered = results.filter((r) => r.score >= minScore);

  const chunks = filtered.map((r) => {
    const meta = r.metadata ? JSON.parse(r.metadata) as { source?: string } : {};
    return {
      content: r.content,
      source: meta.source ?? 'unknown',
      score: r.score,
      chunkIndex: r.chunkIndex,
    };
  });

  // Format as context block for system prompt injection
  const contextBlock = formatContextBlock(chunks);

  return { chunks, contextBlock };
}

/**
 * Format retrieved chunks as a <knowledge> block for system prompt injection.
 */
function formatContextBlock(
  chunks: Array<{ content: string; source: string; score: number }>,
): string {
  if (chunks.length === 0) return '';

  const entries = chunks
    .map((c, i) => `[${i + 1}] (${c.source}, relevance: ${(c.score * 100).toFixed(0)}%)\n${c.content}`)
    .join('\n\n');

  return `<knowledge>\nThe following information was retrieved from the project's knowledge base:\n\n${entries}\n</knowledge>`;
}
