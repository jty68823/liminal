/**
 * Cowork session and message queries.
 */

import { getDb } from '../client.js';
import { coworkSessions, coworkMessages } from '../schema.js';
import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export interface CoworkSession {
  id: string;
  conversationId: string | null;
  task: string;
  agentsConfig: string;
  status: string;
  result: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface CoworkMessage {
  id: string;
  sessionId: string;
  agentRole: string;
  content: string;
  sequence: number;
  createdAt: number;
}

export function createCoworkSession(data: {
  conversationId?: string;
  task: string;
  agentsConfig: string;
}): CoworkSession {
  const db = getDb();
  const now = Date.now();
  const session: CoworkSession = {
    id: nanoid(),
    conversationId: data.conversationId ?? null,
    task: data.task,
    agentsConfig: data.agentsConfig,
    status: 'pending',
    result: null,
    createdAt: now,
    updatedAt: now,
  };
  db.insert(coworkSessions).values(session).run();
  return session;
}

export function getCoworkSession(id: string): CoworkSession | undefined {
  const db = getDb();
  const rows = db.select().from(coworkSessions).where(eq(coworkSessions.id, id)).all();
  return rows[0] as CoworkSession | undefined;
}

export function listCoworkSessions(): CoworkSession[] {
  const db = getDb();
  return db.select().from(coworkSessions).orderBy(desc(coworkSessions.createdAt)).all() as CoworkSession[];
}

export function updateCoworkSession(id: string, update: Partial<Pick<CoworkSession, 'status' | 'result'>>): void {
  const db = getDb();
  db.update(coworkSessions)
    .set({ ...update, updatedAt: Date.now() })
    .where(eq(coworkSessions.id, id))
    .run();
}

export function addCoworkMessage(data: {
  sessionId: string;
  agentRole: string;
  content: string;
  sequence: number;
}): CoworkMessage {
  const db = getDb();
  const msg: CoworkMessage = {
    id: nanoid(),
    sessionId: data.sessionId,
    agentRole: data.agentRole,
    content: data.content,
    sequence: data.sequence,
    createdAt: Date.now(),
  };
  db.insert(coworkMessages).values(msg).run();
  return msg;
}

export function getCoworkMessages(sessionId: string): CoworkMessage[] {
  const db = getDb();
  return db.select().from(coworkMessages)
    .where(eq(coworkMessages.sessionId, sessionId))
    .all() as CoworkMessage[];
}
