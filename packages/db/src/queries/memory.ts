import { eq, desc, isNotNull, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb } from '../client.js';
import { memory } from '../schema.js';

export type Memory = typeof memory.$inferSelect;
export type NewMemory = typeof memory.$inferInsert;

export interface AddMemoryData {
  projectId?: string;
  conversationId?: string;
  content: string;
  embedding?: Buffer;
  source?: string;
}

export function addMemory(data: AddMemoryData): Memory {
  const db = getDb();
  const id = nanoid();
  const now = Date.now();
  const row: NewMemory = {
    id,
    projectId: data.projectId ?? null,
    conversationId: data.conversationId ?? null,
    content: data.content,
    embedding: data.embedding ?? null,
    source: data.source ?? 'explicit',
    createdAt: now,
    lastAccessed: null,
  };
  db.insert(memory).values(row).run();
  return row as Memory;
}

export interface ListMemoryOptions {
  projectId?: string;
  limit?: number;
}

export function listMemory(options: ListMemoryOptions = {}): Memory[] {
  const db = getDb();
  const { projectId, limit = 100 } = options;

  if (projectId !== undefined) {
    return db
      .select()
      .from(memory)
      .where(eq(memory.projectId, projectId))
      .orderBy(desc(memory.createdAt))
      .limit(limit)
      .all();
  }

  return db.select().from(memory).orderBy(desc(memory.createdAt)).limit(limit).all();
}

export function deleteMemory(id: string): void {
  const db = getDb();
  db.delete(memory).where(eq(memory.id, id)).run();
}

// Inline cosine similarity (avoids circular dependency with @liminal/inference)
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export function searchMemoryBySimilarity(
  queryEmbedding: Float32Array,
  options: { projectId?: string; k?: number } = {}
): Array<Memory & { score: number }> {
  const db = getDb();
  const k = options.k ?? 5;

  // Only fetch rows that have embeddings — avoids loading empty rows
  const condition = options.projectId
    ? and(eq(memory.projectId, options.projectId), isNotNull(memory.embedding))
    : isNotNull(memory.embedding);

  const rows = db
    .select()
    .from(memory)
    .where(condition)
    .orderBy(desc(memory.createdAt))
    .limit(200)
    .all();

  if (rows.length === 0) return [];

  const scored = rows.map(r => {
    const buf = r.embedding as Buffer;
    const vec = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
    return { ...r, score: cosineSimilarity(queryEmbedding, vec) };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}
