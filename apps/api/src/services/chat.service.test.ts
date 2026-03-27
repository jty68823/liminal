/**
 * Integration tests for chat.service.ts
 * Tests the core chat orchestration logic with mocked dependencies.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock all external modules ─────────────────────────────────────────────
vi.mock('@liminal/db', () => ({
  getConversation: vi.fn(),
  createConversation: vi.fn(),
  getMessages: vi.fn(),
  createMessage: vi.fn(),
  getProject: vi.fn(),
  listMemory: vi.fn(),
  searchMemoryBySimilarity: vi.fn(),
  updateConversation: vi.fn(),
}));

vi.mock('@liminal/core', () => ({
  assembleContext: vi.fn(),
  toProviderMessages: vi.fn(),
  toOllamaMessages: vi.fn(),
  buildSystemPrompt: vi.fn(),
  detectModelFamily: vi.fn().mockReturnValue('deepseek'),
  getModelFamilyConfig: vi.fn().mockReturnValue({}),
}));

vi.mock('@liminal/inference', () => ({
  runToolCallLoop: vi.fn(),
  defaultRouter: { selectModel: vi.fn() },
  embed: vi.fn(),
  providerRegistry: { get: vi.fn(), list: vi.fn() },
}));

vi.mock('@liminal/tools', () => ({
  registry: { list: vi.fn(), get: vi.fn() },
}));

vi.mock('../lib/logger.js', () => ({
  createChildLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

import {
  getConversation,
  createConversation,
  getMessages,
  createMessage,
  getProject,
  listMemory,
  searchMemoryBySimilarity,
} from '@liminal/db';
import { assembleContext, toProviderMessages, toOllamaMessages, buildSystemPrompt, detectModelFamily, getModelFamilyConfig } from '@liminal/core';
import { runToolCallLoop, defaultRouter, embed, providerRegistry } from '@liminal/inference';
import { registry } from '@liminal/tools';
import { runChat, type ChatRequest, type ChatServiceCallbacks } from './chat.service.js';

// ── Test helpers ─────────────────────────────────────────────────────────

function makeCallbacks(overrides: Partial<ChatServiceCallbacks> = {}): ChatServiceCallbacks & {
  tokens: string[];
  errors: string[];
  doneArgs: unknown[];
} {
  const tokens: string[] = [];
  const errors: string[] = [];
  const doneArgs: unknown[] = [];

  return {
    tokens,
    errors,
    doneArgs,
    onToken: vi.fn((d: string) => { tokens.push(d); }),
    onThinking: vi.fn(),
    onToolCallStart: vi.fn(),
    onToolCallResult: vi.fn(),
    onDone: vi.fn((...args: unknown[]) => { doneArgs.push(args); }),
    onError: vi.fn((msg: string) => { errors.push(msg); }),
    ...overrides,
  };
}

// ── Setup defaults ────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();

  (defaultRouter.selectModel as ReturnType<typeof vi.fn>).mockReturnValue('deepseek-r1:8b');
  (createConversation as ReturnType<typeof vi.fn>).mockReturnValue({ id: 'conv-1', model: 'deepseek-r1:8b' });
  (getMessages as ReturnType<typeof vi.fn>).mockReturnValue([]);
  (buildSystemPrompt as ReturnType<typeof vi.fn>).mockReturnValue('System prompt');
  (assembleContext as ReturnType<typeof vi.fn>).mockReturnValue({ messages: [] });
  (toOllamaMessages as ReturnType<typeof vi.fn>).mockReturnValue([]);
  (toProviderMessages as ReturnType<typeof vi.fn>).mockReturnValue([]);
  (detectModelFamily as ReturnType<typeof vi.fn>).mockReturnValue('deepseek');
  (getModelFamilyConfig as ReturnType<typeof vi.fn>).mockReturnValue({ supportsNativeTools: false, supportsVision: false });
  (registry.list as ReturnType<typeof vi.fn>).mockReturnValue([]);
  (embed as ReturnType<typeof vi.fn>).mockResolvedValue(new Array(384).fill(0));
  (searchMemoryBySimilarity as ReturnType<typeof vi.fn>).mockReturnValue([]);
  (listMemory as ReturnType<typeof vi.fn>).mockReturnValue([]);
  (runToolCallLoop as ReturnType<typeof vi.fn>).mockResolvedValue({
    finalMessages: [],
    totalTokens: 100,
  });
  (createMessage as ReturnType<typeof vi.fn>)
    .mockReturnValueOnce({ id: 'user-msg-1' })
    .mockReturnValueOnce({ id: 'asst-msg-1' });
});

afterEach(() => {
  vi.clearAllTimers();
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe('runChat', () => {
  describe('new conversation creation', () => {
    it('creates a new conversation when no conversationId provided', async () => {
      const req: ChatRequest = { content: 'Hello' };
      const cb = makeCallbacks();

      await runChat(req, cb);

      expect(createConversation).toHaveBeenCalledOnce();
      expect(cb.errors).toHaveLength(0);
    });

    it('selects a model via defaultRouter for new conversations', async () => {
      (defaultRouter.selectModel as ReturnType<typeof vi.fn>).mockReturnValue('qwen2.5-coder:7b');
      (createConversation as ReturnType<typeof vi.fn>).mockReturnValue({ id: 'conv-new', model: 'qwen2.5-coder:7b' });

      const req: ChatRequest = { content: 'Write a function' };
      const cb = makeCallbacks();

      await runChat(req, cb);

      expect(defaultRouter.selectModel).toHaveBeenCalledWith({ messageLength: 16 });
    });

    it('uses model override when provided', async () => {
      (createConversation as ReturnType<typeof vi.fn>).mockReturnValue({ id: 'conv-1', model: 'llama3.2:3b' });

      const req: ChatRequest = { content: 'Hello', modelOverride: 'llama3.2:3b' };
      const cb = makeCallbacks();

      await runChat(req, cb);

      expect(createConversation).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'llama3.2:3b' }),
      );
    });
  });

  describe('existing conversation', () => {
    it('uses existing conversation when conversationId provided', async () => {
      (getConversation as ReturnType<typeof vi.fn>).mockReturnValue({
        id: 'existing-conv',
        model: 'deepseek-r1:8b',
      });
      (getMessages as ReturnType<typeof vi.fn>).mockReturnValue([
        { id: 'msg-1', role: 'user', content: 'Hi', createdAt: 1000 },
        { id: 'msg-2', role: 'assistant', content: 'Hello!', createdAt: 2000 },
      ]);

      const req: ChatRequest = { conversationId: 'existing-conv', content: 'How are you?' };
      const cb = makeCallbacks();

      await runChat(req, cb);

      expect(getConversation).toHaveBeenCalledWith('existing-conv');
      expect(createConversation).not.toHaveBeenCalled();
      expect(getMessages).toHaveBeenCalledWith('existing-conv', { limit: 50 });
    });

    it('calls onError when conversation not found', async () => {
      (getConversation as ReturnType<typeof vi.fn>).mockReturnValue(null);

      const req: ChatRequest = { conversationId: 'missing-conv', content: 'Hello' };
      const cb = makeCallbacks();

      await runChat(req, cb);

      expect(cb.errors).toContain('Conversation not found: missing-conv');
      expect(runToolCallLoop).not.toHaveBeenCalled();
    });
  });

  describe('message persistence', () => {
    it('persists user and assistant messages on success', async () => {
      const req: ChatRequest = { content: 'Test message' };
      const cb = makeCallbacks();

      await runChat(req, cb);

      expect(createMessage).toHaveBeenCalledTimes(2);
      expect(createMessage).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'user', content: 'Test message' }),
      );
      expect(createMessage).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'assistant' }),
      );
    });

    it('calls onDone with conversation and message IDs', async () => {
      const req: ChatRequest = { content: 'Hello' };
      const cb = makeCallbacks();

      await runChat(req, cb);

      expect(cb.doneArgs).toHaveLength(1);
      const [convId, userMsgId, assistantMsgId] = cb.doneArgs[0] as string[];
      expect(convId).toBe('conv-1');
      expect(userMsgId).toBe('user-msg-1');
      expect(assistantMsgId).toBe('asst-msg-1');
    });
  });

  describe('memory integration', () => {
    it('uses vector search for memory snippets when embed succeeds', async () => {
      const vec = new Array(384).fill(0.1);
      (embed as ReturnType<typeof vi.fn>).mockResolvedValue(vec);
      (searchMemoryBySimilarity as ReturnType<typeof vi.fn>).mockReturnValue([
        { content: 'User likes TypeScript' },
        { content: 'Project uses Hono' },
      ]);

      const req: ChatRequest = { content: 'Show me some code' };
      const cb = makeCallbacks();

      await runChat(req, cb);

      expect(searchMemoryBySimilarity).toHaveBeenCalledWith(vec, expect.objectContaining({ k: 3 }));
      expect(buildSystemPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          memory: ['User likes TypeScript', 'Project uses Hono'],
        }),
      );
    });

    it('skips memory when embed fails', async () => {
      (embed as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Ollama not running'));

      const req: ChatRequest = { content: 'Hello there friend' };
      const cb = makeCallbacks();

      await runChat(req, cb);

      expect(listMemory).not.toHaveBeenCalled();
      expect(buildSystemPrompt).toHaveBeenCalledWith(
        expect.objectContaining({ memory: undefined }),
      );
    });
  });

  describe('project context', () => {
    it('injects project system prompt when projectId provided', async () => {
      (getProject as ReturnType<typeof vi.fn>).mockReturnValue({
        id: 'proj-1',
        systemPrompt: 'You are a coding assistant',
      });
      (createConversation as ReturnType<typeof vi.fn>).mockReturnValue({ id: 'conv-1', model: 'deepseek-r1:8b' });

      const req: ChatRequest = { content: 'Help me code', projectId: 'proj-1' };
      const cb = makeCallbacks();

      await runChat(req, cb);

      expect(buildSystemPrompt).toHaveBeenCalledWith(
        expect.objectContaining({ projectPrompt: 'You are a coding assistant' }),
      );
    });

    it('continues without project prompt when project has no systemPrompt', async () => {
      (getProject as ReturnType<typeof vi.fn>).mockReturnValue({ id: 'proj-1' });
      (createConversation as ReturnType<typeof vi.fn>).mockReturnValue({ id: 'conv-1', model: 'deepseek-r1:8b' });

      const req: ChatRequest = { content: 'Hello', projectId: 'proj-1' };
      const cb = makeCallbacks();

      await runChat(req, cb);

      expect(buildSystemPrompt).toHaveBeenCalledWith(
        expect.not.objectContaining({ projectPrompt: expect.anything() }),
      );
    });
  });

  describe('error handling', () => {
    it('calls onError when inference fails', async () => {
      (runToolCallLoop as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Connection refused'),
      );

      const req: ChatRequest = { content: 'Hello' };
      const cb = makeCallbacks();

      await runChat(req, cb);

      expect(cb.errors).toContain('Connection refused');
      expect(createMessage).not.toHaveBeenCalled();
    });

    it('handles abort signal gracefully', async () => {
      const controller = new AbortController();

      (runToolCallLoop as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        controller.abort();
        return { finalMessages: [], totalTokens: 0 };
      });

      const req: ChatRequest = { content: 'Hello' };
      const cb = makeCallbacks({ signal: controller.signal });

      await runChat(req, cb);

      // No error should be emitted for abort
      expect(cb.errors).toHaveLength(0);
    });

    it('calls onError when DB persist fails', async () => {
      (createMessage as ReturnType<typeof vi.fn>).mockReset();
      (createMessage as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('DB write failed');
      });

      const req: ChatRequest = { content: 'Hello' };
      const cb = makeCallbacks();

      await runChat(req, cb);

      expect(cb.errors).toContain('Failed to save message: DB write failed');
    });
  });

  describe('tool configuration', () => {
    it('disables native tools for deepseek-r1 models', async () => {
      const bashTool = { name: 'bash', description: 'Run bash', input_schema: {} };
      (registry.list as ReturnType<typeof vi.fn>).mockReturnValue([bashTool]);
      (createConversation as ReturnType<typeof vi.fn>).mockReturnValue({
        id: 'conv-1',
        model: 'deepseek-r1:8b',
      });

      const req: ChatRequest = { content: 'Run ls', modelOverride: 'deepseek-r1:8b' };
      const cb = makeCallbacks();

      await runChat(req, cb);

      expect(runToolCallLoop).toHaveBeenCalledWith(
        expect.objectContaining({ tools: [] }),
      );
    });

    it('passes tools for non-deepseek models', async () => {
      const bashTool = { name: 'bash', description: 'Run bash', input_schema: {} };
      (registry.list as ReturnType<typeof vi.fn>).mockReturnValue([bashTool]);
      (createConversation as ReturnType<typeof vi.fn>).mockReturnValue({
        id: 'conv-1',
        model: 'qwen2.5-coder:7b',
      });
      (detectModelFamily as ReturnType<typeof vi.fn>).mockReturnValue('qwen');
      (getModelFamilyConfig as ReturnType<typeof vi.fn>).mockReturnValue({ supportsNativeTools: true, supportsVision: false });

      const req: ChatRequest = { content: 'Run ls', modelOverride: 'qwen2.5-coder:7b' };
      const cb = makeCallbacks();

      await runChat(req, cb);

      expect(runToolCallLoop).toHaveBeenCalledWith(
        expect.objectContaining({ tools: [bashTool] }),
      );
    });
  });

  describe('streaming tokens', () => {
    it('forwards token events to onToken callback', async () => {
      (runToolCallLoop as ReturnType<typeof vi.fn>).mockImplementation(async ({ onEvent }) => {
        onEvent({ type: 'token', delta: 'Hello' });
        onEvent({ type: 'token', delta: ' world' });
        onEvent({ type: 'done', finish_reason: 'stop' });
        return { finalMessages: [], totalTokens: 50 };
      });

      const req: ChatRequest = { content: 'Say hello' };
      const cb = makeCallbacks();

      await runChat(req, cb);

      expect(cb.tokens).toEqual(['Hello', ' world']);
    });

    it('forwards thinking events to onThinking callback', async () => {
      (runToolCallLoop as ReturnType<typeof vi.fn>).mockImplementation(async ({ onEvent }) => {
        onEvent({ type: 'thinking', delta: 'Let me think...' });
        onEvent({ type: 'done', finish_reason: 'stop' });
        return { finalMessages: [], totalTokens: 30 };
      });

      const req: ChatRequest = { content: 'Think about this' };
      const cb = makeCallbacks();

      await runChat(req, cb);

      expect(cb.onThinking).toHaveBeenCalledWith('Let me think...');
    });
  });
});
