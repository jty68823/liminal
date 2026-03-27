import { eq, desc, and, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb } from '../client.js';
import { conversations } from '../schema.js';

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;

export interface CreateConversationData {
  projectId?: string;
  title?: string;
  model: string;
  summary?: string;
  metadata?: string;
}

export function createConversation(data: CreateConversationData): Conversation {
  const db = getDb();
  const now = Date.now();
  const id = nanoid();
  const row: NewConversation = {
    id,
    projectId: data.projectId ?? null,
    title: data.title ?? null,
    model: data.model,
    createdAt: now,
    updatedAt: now,
    summary: data.summary ?? null,
    metadata: data.metadata ?? null,
  };
  db.insert(conversations).values(row).run();
  return row as Conversation;
}

export function getConversation(id: string): Conversation | null {
  const db = getDb();
  return db.select().from(conversations).where(eq(conversations.id, id)).get() ?? null;
}

export interface ListConversationsOptions {
  projectId?: string;
  limit?: number;
  offset?: number;
}

export function listConversations(options: ListConversationsOptions = {}): Conversation[] {
  const db = getDb();
  const { projectId, limit = 50, offset = 0 } = options;

  let query = db.select().from(conversations).orderBy(desc(conversations.updatedAt));

  if (projectId !== undefined) {
    return db
      .select()
      .from(conversations)
      .where(eq(conversations.projectId, projectId))
      .orderBy(desc(conversations.updatedAt))
      .limit(limit)
      .offset(offset)
      .all();
  }

  return query.limit(limit).offset(offset).all();
}

export function updateConversation(id: string, data: Partial<Omit<Conversation, 'id' | 'createdAt'>>): void {
  const db = getDb();
  db.update(conversations)
    .set({ ...data, updatedAt: Date.now() })
    .where(eq(conversations.id, id))
    .run();
}

export function deleteConversation(id: string): void {
  const db = getDb();
  db.delete(conversations).where(eq(conversations.id, id)).run();
}
