/**
 * API route tests for /api/v1/auto-task routes.
 * Tests CRUD and SSE stream endpoint behavior.
 *
 * Test pattern follows apps/api/src/routes/messages.test.ts:
 * - vi.mock() for DB and inference module before imports
 * - Hono app.request() for all HTTP assertions
 * - SSE events parsed from plain text body
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// ── Mock @liminal/db ───────────────────────────────────────────────────────

vi.mock('@liminal/db', () => ({
  createAutoTaskRun: vi.fn().mockReturnValue({
    id: 'run-123',
    objective: 'Test objective',
    securityLevel: 1,
    status: 'pending',
    plan: null,
    result: null,
    error: null,
    totalTokens: 0,
    durationMs: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }),
  getAutoTaskRun: vi.fn().mockImplementation((id: string) =>
    id === 'run-123'
      ? {
          id: 'run-123',
          objective: 'Test objective',
          securityLevel: 1,
          status: 'pending',
          plan: null,
          result: null,
          error: null,
          totalTokens: 0,
          durationMs: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
      : undefined,
  ),
  listAutoTaskRuns: vi.fn().mockReturnValue([]),
  updateAutoTaskRun: vi.fn(),
  appendAutoTaskEvent: vi.fn().mockReturnValue({ id: 'ev-1' }),
  getAutoTaskEvents: vi.fn().mockReturnValue([]),
  getSettingParsed: vi.fn().mockReturnValue(undefined),
}));

// ── Mock @liminal/inference ────────────────────────────────────────────────

vi.mock('@liminal/inference', () => ({
  autoTaskOrchestrator: {
    run: vi.fn().mockResolvedValue(undefined),
    abort: vi.fn().mockReturnValue(true),
  },
  agentRegistry: {
    listAll: vi.fn().mockReturnValue([]),
    register: vi.fn(),
    unregister: vi.fn(),
    isBaseRole: vi.fn().mockReturnValue(false),
  },
}));

// ── Mock logger (prevents noise in test output) ───────────────────────────

vi.mock('../lib/logger.js', () => ({
  createChildLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }),
}));

import { autoTaskRouter } from './auto-task.js';
import {
  createAutoTaskRun,
  getAutoTaskRun,
  listAutoTaskRuns,
  updateAutoTaskRun,
  appendAutoTaskEvent,
  getAutoTaskEvents,
} from '@liminal/db';
import { autoTaskOrchestrator } from '@liminal/inference';

// ── Test app setup ─────────────────────────────────────────────────────────

function makeApp() {
  const app = new Hono();
  app.route('/api/v1/auto-task', autoTaskRouter);
  return app;
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function parseSSE(text: string): Promise<Array<{ event?: string; data: string }>> {
  const events: Array<{ event?: string; data: string }> = [];
  const lines = text.split('\n');
  let currentEvent: { event?: string; data: string } | null = null;

  for (const line of lines) {
    if (line.startsWith('event: ')) {
      currentEvent = { event: line.slice(7).trim(), data: '' };
    } else if (line.startsWith('data: ')) {
      if (!currentEvent) currentEvent = { data: '' };
      currentEvent.data = line.slice(6).trim();
    } else if (line === '' && currentEvent) {
      events.push(currentEvent);
      currentEvent = null;
    }
  }

  return events;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Auto Task API Routes', () => {
  const app = makeApp();

  beforeEach(() => {
    vi.resetAllMocks();

    // Re-apply defaults after reset
    (createAutoTaskRun as ReturnType<typeof vi.fn>).mockReturnValue({
      id: 'run-123',
      objective: 'Test objective',
      securityLevel: 1,
      status: 'pending',
      plan: null,
      result: null,
      error: null,
      totalTokens: 0,
      durationMs: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    (getAutoTaskRun as ReturnType<typeof vi.fn>).mockImplementation((id: string) =>
      id === 'run-123'
        ? {
            id: 'run-123',
            objective: 'Test objective',
            securityLevel: 1,
            status: 'pending',
            plan: null,
            result: null,
            error: null,
            totalTokens: 0,
            durationMs: null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }
        : undefined,
    );

    (listAutoTaskRuns as ReturnType<typeof vi.fn>).mockReturnValue([]);
    (updateAutoTaskRun as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    (appendAutoTaskEvent as ReturnType<typeof vi.fn>).mockReturnValue({ id: 'ev-1' });
    (getAutoTaskEvents as ReturnType<typeof vi.fn>).mockReturnValue([]);

    (autoTaskOrchestrator.run as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (autoTaskOrchestrator.abort as ReturnType<typeof vi.fn>).mockReturnValue(true);
  });

  // ── POST / ──────────────────────────────────────────────────────────────

  describe('POST /api/v1/auto-task', () => {
    it('creates a run and returns 201 with run data', async () => {
      const res = await app.request('/api/v1/auto-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objective: 'Write a report on AI', security_level: 1 }),
      });

      expect(res.status).toBe(201);
      const data = (await res.json()) as { run: { id: string }; message: string };
      expect(data.run.id).toBe('run-123');
      expect(data.message).toBe('Auto task created');
    });

    it('calls createAutoTaskRun with correct arguments', async () => {
      await app.request('/api/v1/auto-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objective: 'My objective', security_level: 2 }),
      });

      expect(createAutoTaskRun).toHaveBeenCalledWith(
        expect.objectContaining({ objective: 'My objective', securityLevel: 2 }),
      );
    });

    it('returns 400 when objective is missing', async () => {
      const res = await app.request('/api/v1/auto-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ security_level: 1 }),
      });

      expect(res.status).toBe(400);
    });

    it('returns 400 when objective is an empty string', async () => {
      const res = await app.request('/api/v1/auto-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objective: '', security_level: 1 }),
      });

      expect(res.status).toBe(400);
    });

    it('defaults security_level to 1 when not provided', async () => {
      await app.request('/api/v1/auto-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objective: 'No security level' }),
      });

      expect(createAutoTaskRun).toHaveBeenCalledWith(
        expect.objectContaining({ securityLevel: 1 }),
      );
    });
  });

  // ── GET / ───────────────────────────────────────────────────────────────

  describe('GET /api/v1/auto-task', () => {
    it('returns 200 with runs array', async () => {
      const res = await app.request('/api/v1/auto-task');

      expect(res.status).toBe(200);
      const data = (await res.json()) as { runs: unknown[] };
      expect(Array.isArray(data.runs)).toBe(true);
    });

    it('returns populated runs when DB has records', async () => {
      const mockRun = {
        id: 'run-abc',
        objective: 'Some task',
        securityLevel: 1,
        status: 'completed',
        plan: null,
        result: 'done',
        error: null,
        totalTokens: 500,
        durationMs: 1200,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      (listAutoTaskRuns as ReturnType<typeof vi.fn>).mockReturnValueOnce([mockRun]);

      const res = await app.request('/api/v1/auto-task');
      const data = (await res.json()) as { runs: typeof mockRun[] };
      expect(data.runs.length).toBe(1);
      expect(data.runs[0]?.id).toBe('run-abc');
    });
  });

  // ── GET /:id ─────────────────────────────────────────────────────────────

  describe('GET /api/v1/auto-task/:id', () => {
    it('returns 200 with run details for a known ID', async () => {
      const res = await app.request('/api/v1/auto-task/run-123');

      expect(res.status).toBe(200);
      const data = (await res.json()) as { run: { id: string }; events: unknown[] };
      expect(data.run.id).toBe('run-123');
      expect(Array.isArray(data.events)).toBe(true);
    });

    it('returns 404 for an unknown ID', async () => {
      const res = await app.request('/api/v1/auto-task/does-not-exist');

      expect(res.status).toBe(404);
      const data = (await res.json()) as { error: string };
      expect(data.error).toBeDefined();
    });
  });

  // ── DELETE /:id ──────────────────────────────────────────────────────────

  describe('DELETE /api/v1/auto-task/:id', () => {
    it('cancels a run and returns success:true', async () => {
      const res = await app.request('/api/v1/auto-task/run-123', {
        method: 'DELETE',
      });

      expect(res.status).toBe(200);
      const data = (await res.json()) as { success: boolean };
      expect(data.success).toBe(true);
    });

    it('calls abort on the orchestrator with the correct run ID', async () => {
      await app.request('/api/v1/auto-task/run-123', { method: 'DELETE' });

      expect(autoTaskOrchestrator.abort).toHaveBeenCalledWith('run-123');
    });

    it('calls updateAutoTaskRun with status cancelled', async () => {
      await app.request('/api/v1/auto-task/run-123', { method: 'DELETE' });

      expect(updateAutoTaskRun).toHaveBeenCalledWith(
        'run-123',
        expect.objectContaining({ status: 'cancelled' }),
      );
    });

    it('returns 404 for an unknown ID', async () => {
      const res = await app.request('/api/v1/auto-task/unknown-id', {
        method: 'DELETE',
      });

      expect(res.status).toBe(404);
    });
  });

  // ── GET /:id/stream ──────────────────────────────────────────────────────

  describe('GET /api/v1/auto-task/:id/stream', () => {
    it('returns text/event-stream content-type for a known run', async () => {
      const res = await app.request('/api/v1/auto-task/run-123/stream');

      expect(res.headers.get('content-type')).toContain('text/event-stream');
    });

    it('returns 404 for an unknown run ID', async () => {
      const res = await app.request('/api/v1/auto-task/unknown-run/stream');

      expect(res.status).toBe(404);
    });

    it('calls autoTaskOrchestrator.run for a pending run', async () => {
      const res = await app.request('/api/v1/auto-task/run-123/stream');

      // Must consume stream body so the SSE handler runs to completion
      await res.text();

      expect(autoTaskOrchestrator.run).toHaveBeenCalledWith(
        'run-123',
        'Test objective',
        1,
        expect.objectContaining({ onEvent: expect.any(Function) }),
      );
    });

    it('does not call orchestrator.run when run is already completed', async () => {
      (getAutoTaskRun as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce({
          // First call — router fetches the run
          id: 'run-123',
          objective: 'Test objective',
          securityLevel: 1,
          status: 'pending',
          plan: null,
          result: null,
          error: null,
          totalTokens: 0,
          durationMs: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
        .mockReturnValueOnce({
          // Second call inside stream handler — already completed
          id: 'run-123',
          objective: 'Test objective',
          securityLevel: 1,
          status: 'completed',
          plan: null,
          result: 'done',
          error: null,
          totalTokens: 100,
          durationMs: 500,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

      await app.request('/api/v1/auto-task/run-123/stream');

      expect(autoTaskOrchestrator.run).not.toHaveBeenCalled();
    });

    it('replays existing events for reconnecting clients', async () => {
      const existingEvent = {
        id: 'ev-existing',
        runId: 'run-123',
        type: 'auto_task_plan',
        payload: JSON.stringify({ type: 'auto_task_plan', runId: 'run-123', plan: {} }),
        subtaskId: null,
        createdAt: Date.now(),
      };

      const { getAutoTaskEvents } = await import('@liminal/db');
      (getAutoTaskEvents as ReturnType<typeof vi.fn>).mockReturnValueOnce([existingEvent]);

      const res = await app.request('/api/v1/auto-task/run-123/stream');
      const body = await res.text();
      const events = await parseSSE(body);

      const planEvent = events.find((e) => e.event === 'auto_task_plan');
      expect(planEvent).toBeDefined();
    });
  });
});
