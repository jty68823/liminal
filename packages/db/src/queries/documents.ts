/**
 * Document queries for the knowledge base / RAG system.
 */

import { getDb } from '../client.js';
import { documents, documentChunks } from '../schema.js';
import { eq, and, isNotNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export interface Document {
  id: string;
  projectId: string | null;
  filename: string;
  mimeType: string | null;
  status: string;
  chunkCount: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  embedding: Buffer | null;
  chunkIndex: number;
  metadata: string | null;
  createdAt: number;
}

export function createDocument(data: {
  projectId?: string;
  filename: string;
  mimeType?: string;
}): Document {
  const db = getDb();
  const now = Date.now();
  const doc = {
    id: nanoid(),
    projectId: data.projectId ?? null,
    filename: data.filename,
    mimeType: data.mimeType ?? null,
    status: 'pending',
    chunkCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  db.insert(documents).values(doc).run();
  return doc;
}

export function getDocument(id: string): Document | undefined {
  const db = getDb();
  const rows = db.select().from(documents).where(eq(documents.id, id)).all();
  return rows[0] as Document | undefined;
}

export function listDocuments(projectId?: string): Document[] {
  const db = getDb();
  if (projectId) {
    return db.select().from(documents).where(eq(documents.projectId, projectId)).all() as Document[];
  }
  return db.select().from(documents).all() as Document[];
}

export function updateDocumentStatus(id: string, status: string, chunkCount?: number): void {
  const db = getDb();
  const update: Record<string, unknown> = { status, updatedAt: Date.now() };
  if (chunkCount !== undefined) update.chunkCount = chunkCount;
  db.update(documents).set(update).where(eq(documents.id, id)).run();
}

export function deleteDocument(id: string): void {
  const db = getDb();
  db.delete(documentChunks).where(eq(documentChunks.documentId, id)).run();
  db.delete(documents).where(eq(documents.id, id)).run();
}

export function addDocumentChunk(data: {
  documentId: string;
  content: string;
  embedding?: Buffer;
  chunkIndex: number;
  metadata?: string;
}): DocumentChunk {
  const db = getDb();
  const chunk = {
    id: nanoid(),
    documentId: data.documentId,
    content: data.content,
    embedding: data.embedding ?? null,
    chunkIndex: data.chunkIndex,
    metadata: data.metadata ?? null,
    createdAt: Date.now(),
  };
  db.insert(documentChunks).values(chunk).run();
  return chunk;
}

export function getDocumentChunks(documentId: string): DocumentChunk[] {
  const db = getDb();
  return db.select().from(documentChunks)
    .where(eq(documentChunks.documentId, documentId))
    .all() as DocumentChunk[];
}

/**
 * Searches document chunks by cosine similarity to a query embedding.
 * Similar to searchMemoryBySimilarity but for document chunks.
 */
export function searchChunksBySimilarity(
  queryEmbedding: Float32Array,
  options: { projectId?: string; k?: number } = {},
): Array<DocumentChunk & { score: number }> {
  const db = getDb();
  const k = options.k ?? 5;

  // Load chunks that have embeddings (filtered at DB level)
  let allChunks: Array<DocumentChunk & { docProjectId?: string | null }>;
  if (options.projectId) {
    // Join with documents to filter by project
    const rows = db.select({
      id: documentChunks.id,
      documentId: documentChunks.documentId,
      content: documentChunks.content,
      embedding: documentChunks.embedding,
      chunkIndex: documentChunks.chunkIndex,
      metadata: documentChunks.metadata,
      createdAt: documentChunks.createdAt,
      docProjectId: documents.projectId,
    })
      .from(documentChunks)
      .innerJoin(documents, eq(documentChunks.documentId, documents.id))
      .where(and(eq(documents.projectId, options.projectId), isNotNull(documentChunks.embedding)))
      .limit(500)
      .all();
    allChunks = rows as unknown as Array<DocumentChunk & { docProjectId?: string | null }>;
  } else {
    allChunks = db.select().from(documentChunks)
      .where(isNotNull(documentChunks.embedding))
      .limit(500)
      .all() as unknown as Array<DocumentChunk & { docProjectId?: string | null }>;
  }

  // Score by cosine similarity
  const scored = allChunks
    .map((chunk) => {
      const storedEmbedding = new Float32Array(
        (chunk.embedding as unknown as Buffer).buffer,
        (chunk.embedding as unknown as Buffer).byteOffset,
        (chunk.embedding as unknown as Buffer).byteLength / 4,
      );

      if (queryEmbedding.length !== storedEmbedding.length) return { ...chunk, score: 0 };
      let dot = 0, normA = 0, normB = 0;
      for (let i = 0; i < queryEmbedding.length; i++) {
        dot += queryEmbedding[i] * storedEmbedding[i];
        normA += queryEmbedding[i] * queryEmbedding[i];
        normB += storedEmbedding[i] * storedEmbedding[i];
      }
      const denom = Math.sqrt(normA) * Math.sqrt(normB);
      const score = denom === 0 ? 0 : dot / denom;

      return { ...chunk, score };
    });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}
