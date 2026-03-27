import { eq, desc, asc, and, gt } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb } from '../client.js';
import { messages } from '../schema.js';

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

export interface CreateMessageData {
  conversationId: string;
  role: string;
  content: string;
  toolCalls?: string;
  toolCallId?: string;
  tokensInput?: number;
  tokensOutput?: number;
  model?: string;
  images?: string;
  sequence: number;
}

export function createMessage(data: CreateMessageData): Message {
  const db = getDb();
  const id = nanoid();
  const now = Date.now();
  const row: NewMessage = {
    id,
    conversationId: data.conversationId,
    role: data.role,
    content: data.content,
    toolCalls: data.toolCalls ?? null,
    toolCallId: data.toolCallId ?? null,
    tokensInput: data.tokensInput ?? null,
    tokensOutput: data.tokensOutput ?? null,
    model: data.model ?? null,
    images: data.images ?? null,
    createdAt: now,
    sequence: data.sequence,
  };
  db.insert(messages).values(row).run();
  return row as Message;
}

export interface GetMessagesOptions {
  limit?: number;
  offset?: number;
}

export function getMessages(conversationId: string, options: GetMessagesOptions = {}): Message[] {
  const db = getDb();
  const { limit = 100, offset = 0 } = options;
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.sequence))
    .limit(limit)
    .offset(offset)
    .all();
}

export function getLastMessages(conversationId: string, n: number): Message[] {
  const db = getDb();
  // Fetch last n messages ordered descending, then reverse for chronological order
  const rows = db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.sequence))
    .limit(n)
    .all();
  return rows.reverse();
}

/**
 * Update an existing message's content.
 */
export function updateMessage(id: string, content: string): void {
  const db = getDb();
  db.update(messages)
    .set({ content })
    .where(eq(messages.id, id))
    .run();
}

/**
 * Delete all messages in a conversation with sequence > the given value.
 * Used to remove responses after an edited message.
 */
export function deleteMessagesAfter(conversationId: string, sequence: number): void {
  const db = getDb();
  db.delete(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        gt(messages.sequence, sequence),
      ),
    )
    .run();
}

/**
 * Get a single message by ID.
 */
export function getMessage(id: string): Message | null {
  const db = getDb();
  return db.select().from(messages).where(eq(messages.id, id)).get() ?? null;
}
