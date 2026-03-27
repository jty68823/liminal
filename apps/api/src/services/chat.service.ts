import {
  getConversation,
  createConversation,
  getMessages,
  createMessage,
  getProject,
  listMemory,
  searchMemoryBySimilarity,
  updateConversation,
} from '@liminal/db';
import {
  assembleContext,
  toProviderMessages,
  buildSystemPrompt,
  detectModelFamily,
  getModelFamilyConfig,
} from '@liminal/core';
import { runToolCallLoop, defaultRouter, embed, providerRegistry, type LoopEvent, type ChatMessage } from '@liminal/inference';
import { registry } from '@liminal/tools';
import type { Message, ContentBlock } from '@liminal/core';
import { createChildLogger } from '../lib/logger.js';

const log = createChildLogger('chat');

export interface ChatRequest {
  conversationId?: string;
  projectId?: string;
  content: string;
  modelOverride?: string;
  images?: string[];
}

export interface ChatServiceCallbacks {
  onToken: (delta: string) => Promise<void> | void;
  onThinking: (delta: string) => Promise<void> | void;
  onToolCallStart: (id: string, name: string, input: Record<string, unknown>) => Promise<void> | void;
  onToolCallResult: (id: string, output: string, isError: boolean) => Promise<void> | void;
  onDone: (conversationId: string, userMessageId: string, assistantMessageId: string, tokensIn: number, tokensOut: number) => Promise<void> | void;
  onError: (message: string) => Promise<void> | void;
  signal?: AbortSignal;
}

function dbMessageToCore(dbMsg: {
  id: string;
  role: string;
  content: string;
  createdAt: number;
  model?: string | null;
  tokensInput?: number | null;
  tokensOutput?: number | null;
}): Message {
  return {
    id: dbMsg.id,
    role: dbMsg.role as Message['role'],
    content: dbMsg.content,
    created_at: dbMsg.createdAt,
    model: dbMsg.model ?? undefined,
    tokens_input: dbMsg.tokensInput ?? undefined,
    tokens_output: dbMsg.tokensOutput ?? undefined,
  };
}

/**
 * Core chat orchestration service.
 * Uses an event queue to bridge sync onEvent callbacks with async SSE writes.
 */
export async function runChat(
  request: ChatRequest,
  callbacks: ChatServiceCallbacks,
): Promise<void> {
  const { conversationId: requestedConvId, projectId, content, modelOverride, images } = request;
  const { onToken, onThinking, onToolCallStart, onToolCallResult, onDone, onError, signal } = callbacks;

  // ── 1. Resolve or create conversation ────────────────────────────────────
  let convId = requestedConvId;
  let model = modelOverride;

  try {
    if (convId) {
      const existing = getConversation(convId);
      if (!existing) {
        await onError(`Conversation not found: ${convId}`);
        return;
      }
      if (!model) model = existing.model;
    } else {
      if (!model) {
        model = defaultRouter.selectModel({ messageLength: content.length });
      }
      const newConv = createConversation({ projectId: projectId ?? undefined, model });
      convId = newConv.id;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ err: msg }, 'DB error resolving conversation');
    await onError(`Database error: ${msg}`);
    return;
  }

  // ── 2. Load conversation history ──────────────────────────────────────────
  let dbMessages: ReturnType<typeof getMessages>;
  try {
    dbMessages = getMessages(convId, { limit: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ err: msg }, 'DB error loading messages');
    await onError(`Database error: ${msg}`);
    return;
  }

  const historyMessages: Message[] = dbMessages.map(dbMessageToCore);

  // ── 3. Build system prompt ────────────────────────────────────────────────
  let projectPrompt: string | undefined;
  if (projectId) {
    try {
      const project = getProject(projectId);
      if (project?.systemPrompt) projectPrompt = project.systemPrompt;
    } catch { /* non-fatal */ }
  }

  let memorySnippets: string[] = [];
  try {
    const queryVec = await embed(content);
    const topMem = searchMemoryBySimilarity(queryVec, { projectId: projectId ?? undefined, k: 5 });
    memorySnippets = topMem.map((m) => m.content);
  } catch {
    try {
      const memoryRows = listMemory({ projectId: projectId ?? undefined, limit: 10 });
      memorySnippets = memoryRows.map((m) => m.content);
    } catch { /* non-fatal */ }
  }

  const systemPrompt = buildSystemPrompt({
    projectPrompt,
    memory: memorySnippets.length > 0 ? memorySnippets : undefined,
    constitutionalRules: true,
  });

  // ── 4. Add user message to context ───────────────────────────────────────
  const userCoreMessage: Message = {
    id: `user-${Date.now()}`,
    role: 'user',
    content: images?.length
      ? ([
          { type: 'text', text: content },
          ...images.map(data => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg' as const, data } })),
        ] as ContentBlock[])
      : content,
    created_at: Date.now(),
  };

  const allMessages = [...historyMessages, userCoreMessage];
  const convStub = {
    id: convId,
    model: model!,
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  const assembled = assembleContext(convStub as Parameters<typeof assembleContext>[0], allMessages, {
    systemPrompt,
  });

  const providerMessages: ChatMessage[] = toProviderMessages(assembled) as ChatMessage[];
  const toolDefs = registry.list();

  // Detect model family for tool calling support
  const modelFamily = detectModelFamily(model ?? '');
  const familyConfig = getModelFamilyConfig(modelFamily);
  const modelSupportsNativeTools = familyConfig.supportsNativeTools;
  const toolsToSend = modelSupportsNativeTools ? toolDefs : [];

  log.info({ model, convId }, 'Starting inference');

  let fullAssistantText = '';
  let totalTokensIn = 0;
  let totalTokensOut = 0;

  try {
    let writeChain = Promise.resolve();

    if (images?.length && !familyConfig.supportsVision) {
      writeChain = writeChain.then(() => Promise.resolve(onToken('[Note: Current model does not support vision. Switch to a vision model (e.g. LLaVA) for image analysis.]\n\n')));
    }

    const result = await runToolCallLoop({
      model: model!,
      messages: providerMessages,
      tools: toolsToSend,
      toolExecutor: async (name, input) => {
        const handler = registry.get(name);
        if (!handler) {
          return { tool_use_id: name, output: `Unknown tool: ${name}`, is_error: true };
        }
        try {
          const output = await handler.execute(input);
          return { tool_use_id: name, output, is_error: false };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return { tool_use_id: name, output: msg, is_error: true };
        }
      },
      onEvent: (event: LoopEvent) => {
        if (signal?.aborted) return;

        switch (event.type) {
          case 'token':
            fullAssistantText += event.delta;
            writeChain = writeChain.then(() => Promise.resolve(onToken(event.delta)));
            break;
          case 'thinking':
            writeChain = writeChain.then(() => Promise.resolve(onThinking(event.delta)));
            break;
          case 'tool_call':
            writeChain = writeChain.then(() => Promise.resolve(onToolCallStart(event.id, event.name, event.input)));
            break;
          case 'tool_call_result':
            writeChain = writeChain.then(() => Promise.resolve(onToolCallResult(event.id, event.output, event.is_error)));
            break;
          case 'done':
            break;
        }
      },
    });

    // Wait for the write chain to drain
    await writeChain;

    totalTokensIn = Math.floor(result.totalTokens * 0.6);
    totalTokensOut = result.totalTokens - totalTokensIn;

    log.info({ tokens: result.totalTokens, chars: fullAssistantText.length }, 'Inference complete');

  } catch (err) {
    if (signal?.aborted) return;
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ err: msg }, 'Inference error');
    await onError(msg);
    return;
  }

  if (signal?.aborted) return;

  // ── 7. Persist messages ──────────────────────────────────────────────────
  const existingCount = dbMessages.length;

  try {
    const userDbMsg = createMessage({
      conversationId: convId,
      role: 'user',
      content,
      images: images ? JSON.stringify(images) : undefined,
      sequence: existingCount,
    });

    const assistantDbMsg = createMessage({
      conversationId: convId,
      role: 'assistant',
      content: fullAssistantText,
      model: model ?? undefined,
      tokensInput: totalTokensIn,
      tokensOutput: totalTokensOut,
      sequence: existingCount + 1,
    });

    await onDone(convId, userDbMsg.id, assistantDbMsg.id, totalTokensIn, totalTokensOut);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ err: msg }, 'DB persist error');
    await onError(`Failed to save message: ${msg}`);
  }

  // Fire-and-forget: extract key facts for memory
  const _convIdForMemory = convId;
  const _contentForMemory = content;
  const _textForMemory = fullAssistantText;
  setImmediate(async () => {
    try {
      const provider = providerRegistry.getActive();
      const { addMemoryWithEmbedding } = await import('./memory.service.js');
      const extractPrompt = `Extract 1-3 short factual statements worth remembering from this conversation exchange. Reply with ONLY a JSON array of strings like ["User prefers TypeScript", "Project uses Hono"]. If nothing worth remembering, reply [].

User said: "${_contentForMemory.slice(0, 300)}"
Assistant said: "${_textForMemory.slice(0, 300)}"`;
      const r = await provider.chat({
        model: model ?? process.env['LIMINAL_DEFAULT_MODEL'] ?? 'Meta-Llama-3.1-8B-Instruct-Q4_K_M',
        messages: [{ role: 'user', content: extractPrompt }],
      });
      const match = r.message.content.match(/\[[\s\S]*?\]/);
      if (!match) return;
      const facts: string[] = JSON.parse(match[0]);
      for (const fact of facts.slice(0, 3)) {
        if (typeof fact === 'string' && fact.trim()) {
          await addMemoryWithEmbedding({ content: fact, conversationId: _convIdForMemory, source: 'auto' });
        }
      }
    } catch { /* non-fatal */ }
  });
}
