/**
 * API route tests for POST /api/v1/messages
 * Tests SSE streaming endpoint behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('../services/chat.service.js', () => ({
  runChat: vi.fn(),
}));

vi.mock('../lib/logger.js', () => ({
  createChildLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }),
}));

import { runChat } from '../services/chat.service.js';
import { messagesRouter } from './messages.js';

// ── Test app setup ─────────────────────────────────────────────────────────

function makeApp() {
  const app = new Hono();
  app.route('/api/v1/messages', messagesRouter);
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

describe('POST /api/v1/messages', () => {
  const app = makeApp();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 400 when content is missing', async () => {
    const res = await app.request('/api/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });

  it('returns 400 when content is empty string', async () => {
    const res = await app.request('/api/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '' }),
    });

    expect(res.status).toBe(400);
  });

  it('returns SSE stream with correct content-type', async () => {
    (runChat as ReturnType<typeof vi.fn>).mockImplementation(async (_req, cb) => {
      await cb.onDone('conv-1', 'user-1', 'asst-1', 10, 20);
    });

    const res = await app.request('/api/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Hello' }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
  });

  it('emits done event with conversation and message IDs', async () => {
    (runChat as ReturnType<typeof vi.fn>).mockImplementation(async (_req, cb) => {
      await cb.onDone('conv-abc', 'user-xyz', 'asst-xyz', 100, 200);
    });

    const res = await app.request('/api/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Hello' }),
    });

    const body = await res.text();
    const events = await parseSSE(body);
    const doneEvent = events.find((e) => e.event === 'done');

    expect(doneEvent).toBeDefined();
    const data = JSON.parse(doneEvent!.data);
    expect(data.conversation_id).toBe('conv-abc');
    expect(data.user_message_id).toBe('user-xyz');
    expect(data.assistant_message_id).toBe('asst-xyz');
  });

  it('emits token events during streaming', async () => {
    (runChat as ReturnType<typeof vi.fn>).mockImplementation(async (_req, cb) => {
      await cb.onToken('Hello');
      await cb.onToken(', world!');
      await cb.onDone('conv-1', 'u-1', 'a-1', 5, 10);
    });

    const res = await app.request('/api/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Say hello' }),
    });

    const body = await res.text();
    const events = await parseSSE(body);
    const tokenEvents = events.filter((e) => e.event === 'token');

    expect(tokenEvents.length).toBeGreaterThanOrEqual(1);
  });

  it('emits error event when chat service fails', async () => {
    (runChat as ReturnType<typeof vi.fn>).mockImplementation(async (_req, cb) => {
      await cb.onError('Ollama connection refused');
    });

    const res = await app.request('/api/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Hello' }),
    });

    const body = await res.text();
    const events = await parseSSE(body);
    const errorEvent = events.find((e) => e.event === 'error');

    expect(errorEvent).toBeDefined();
    const data = JSON.parse(errorEvent!.data);
    expect(data.message).toContain('Ollama connection refused');
  });

  it('passes conversationId and projectId to chat service', async () => {
    (runChat as ReturnType<typeof vi.fn>).mockImplementation(async (_req, cb) => {
      await cb.onDone('conv-1', 'u-1', 'a-1', 0, 0);
    });

    await app.request('/api/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'Hello',
        conversation_id: 'conv-existing',
        project_id: 'proj-1',
        model_override: 'llama3.2:3b',
      }),
    });

    expect(runChat).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conv-existing',
        projectId: 'proj-1',
        modelOverride: 'llama3.2:3b',
      }),
      expect.anything(),
    );
  });
});
