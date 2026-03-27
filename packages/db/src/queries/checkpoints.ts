import { eq, desc, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb } from '../client.js';
import { checkpoints } from '../schema.js';

export type Checkpoint = typeof checkpoints.$inferSelect;

const MAX_CHECKPOINTS = 10;

export function createCheckpoint(conversationId: string, messagesJson: string): Checkpoint {
  const db = getDb();
  const id = nanoid();
  const now = Date.now();
  db.insert(checkpoints).values({ id, conversationId, messagesJson, createdAt: now }).run();

  // Prune old checkpoints beyond MAX_CHECKPOINTS
  const all = db
    .select()
    .from(checkpoints)
    .where(eq(checkpoints.conversationId, conversationId))
    .orderBy(desc(checkpoints.createdAt))
    .all();

  if (all.length > MAX_CHECKPOINTS) {
    const toDelete = all.slice(MAX_CHECKPOINTS);
    for (const cp of toDelete) {
      db.delete(checkpoints).where(eq(checkpoints.id, cp.id)).run();
    }
  }

  return db.select().from(checkpoints).where(eq(checkpoints.id, id)).get() as Checkpoint;
}

export function listCheckpoints(conversationId: string): Checkpoint[] {
  const db = getDb();
  return db
    .select()
    .from(checkpoints)
    .where(eq(checkpoints.conversationId, conversationId))
    .orderBy(desc(checkpoints.createdAt))
    .all();
}

export function getLatestCheckpoint(conversationId: string): Checkpoint | undefined {
  const db = getDb();
  return db
    .select()
    .from(checkpoints)
    .where(eq(checkpoints.conversationId, conversationId))
    .orderBy(desc(checkpoints.createdAt))
    .limit(1)
    .get();
}

export function deleteCheckpoint(id: string): void {
  const db = getDb();
  db.delete(checkpoints).where(eq(checkpoints.id, id)).run();
}
