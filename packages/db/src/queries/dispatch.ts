/**
 * Dispatch task and event queries.
 */

import { getDb } from '../client.js';
import { dispatchTasks, dispatchEvents } from '../schema.js';
import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export interface DispatchTask {
  id: string;
  source: string;
  instruction: string;
  status: string;
  result: string | null;
  screenshotBase64: string | null;
  progress: number;
  model: string | null;
  conversationId: string | null;
  errorMessage: string | null;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
}

export interface DispatchEvent {
  id: string;
  taskId: string;
  type: string;
  payload: string;
  createdAt: number;
}

export function createDispatchTask(data: {
  instruction: string;
  source?: string;
  model?: string;
}): DispatchTask {
  const db = getDb();
  const now = Date.now();
  const task: DispatchTask = {
    id: nanoid(),
    source: data.source ?? 'api',
    instruction: data.instruction,
    status: 'pending',
    result: null,
    screenshotBase64: null,
    progress: 0,
    model: data.model ?? null,
    conversationId: null,
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };
  db.insert(dispatchTasks).values(task).run();
  return task;
}

export function getDispatchTask(id: string): DispatchTask | undefined {
  const db = getDb();
  const rows = db.select().from(dispatchTasks).where(eq(dispatchTasks.id, id)).all();
  return rows[0] as DispatchTask | undefined;
}

export function listDispatchTasks(limit = 50): DispatchTask[] {
  const db = getDb();
  return db.select().from(dispatchTasks)
    .orderBy(desc(dispatchTasks.createdAt))
    .limit(limit)
    .all() as DispatchTask[];
}

export function updateDispatchTask(
  id: string,
  update: Partial<Pick<DispatchTask, 'status' | 'result' | 'screenshotBase64' | 'progress' | 'conversationId' | 'errorMessage' | 'completedAt'>>,
): void {
  const db = getDb();
  db.update(dispatchTasks)
    .set({ ...update, updatedAt: Date.now() })
    .where(eq(dispatchTasks.id, id))
    .run();
}

export function deleteDispatchTask(id: string): void {
  const db = getDb();
  db.delete(dispatchEvents).where(eq(dispatchEvents.taskId, id)).run();
  db.delete(dispatchTasks).where(eq(dispatchTasks.id, id)).run();
}

export function appendDispatchEvent(data: {
  taskId: string;
  type: string;
  payload: string;
}): DispatchEvent {
  const db = getDb();
  const event: DispatchEvent = {
    id: nanoid(),
    taskId: data.taskId,
    type: data.type,
    payload: data.payload,
    createdAt: Date.now(),
  };
  db.insert(dispatchEvents).values(event).run();
  return event;
}

export function getDispatchEvents(taskId: string): DispatchEvent[] {
  const db = getDb();
  return db.select().from(dispatchEvents)
    .where(eq(dispatchEvents.taskId, taskId))
    .orderBy(dispatchEvents.createdAt)
    .all() as DispatchEvent[];
}
