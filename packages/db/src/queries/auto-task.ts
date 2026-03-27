/**
 * Auto Task run and event queries.
 */

import { getDb } from '../client.js';
import { autoTaskRuns, autoTaskEvents } from '../schema.js';
import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export interface AutoTaskRun {
  id: string;
  objective: string;
  securityLevel: number;
  status: string;
  plan: string | null;
  result: string | null;
  error: string | null;
  totalTokens: number;
  durationMs: number | null;
  maxConcurrent: number;
  concurrencyStrategy: string;
  createdAt: number;
  updatedAt: number;
}

export interface AutoTaskEvent {
  id: string;
  runId: string;
  type: string;
  payload: string;
  subtaskId: string | null;
  createdAt: number;
}

export function createAutoTaskRun(data: {
  objective: string;
  securityLevel: 1 | 2 | 3;
  maxConcurrent?: number;
  concurrencyStrategy?: string;
}): AutoTaskRun {
  const db = getDb();
  const now = Date.now();
  const run: AutoTaskRun = {
    id: nanoid(),
    objective: data.objective,
    securityLevel: data.securityLevel,
    status: 'pending',
    plan: null,
    result: null,
    error: null,
    totalTokens: 0,
    durationMs: null,
    maxConcurrent: data.maxConcurrent ?? 3,
    concurrencyStrategy: data.concurrencyStrategy ?? 'adaptive',
    createdAt: now,
    updatedAt: now,
  };
  db.insert(autoTaskRuns).values(run).run();
  return run;
}

export function getAutoTaskRun(id: string): AutoTaskRun | undefined {
  const db = getDb();
  const rows = db.select().from(autoTaskRuns).where(eq(autoTaskRuns.id, id)).all();
  return rows[0] as AutoTaskRun | undefined;
}

export function listAutoTaskRuns(limit = 50): AutoTaskRun[] {
  const db = getDb();
  return db.select().from(autoTaskRuns)
    .orderBy(desc(autoTaskRuns.createdAt))
    .limit(limit)
    .all() as AutoTaskRun[];
}

export function updateAutoTaskRun(
  id: string,
  update: Partial<Pick<AutoTaskRun, 'status' | 'plan' | 'result' | 'error' | 'totalTokens' | 'durationMs'>>,
): void {
  const db = getDb();
  db.update(autoTaskRuns)
    .set({ ...update, updatedAt: Date.now() })
    .where(eq(autoTaskRuns.id, id))
    .run();
}

export function appendAutoTaskEvent(data: {
  runId: string;
  type: string;
  payload: string;
  subtaskId?: string;
}): AutoTaskEvent {
  const db = getDb();
  const event: AutoTaskEvent = {
    id: nanoid(),
    runId: data.runId,
    type: data.type,
    payload: data.payload,
    subtaskId: data.subtaskId ?? null,
    createdAt: Date.now(),
  };
  db.insert(autoTaskEvents).values(event).run();
  return event;
}

export function getAutoTaskEvents(runId: string): AutoTaskEvent[] {
  const db = getDb();
  return db.select().from(autoTaskEvents)
    .where(eq(autoTaskEvents.runId, runId))
    .orderBy(autoTaskEvents.createdAt)
    .all() as AutoTaskEvent[];
}
