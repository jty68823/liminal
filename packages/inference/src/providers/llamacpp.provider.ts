/**
 * LlamaCpp provider — implements InferenceProvider using node-llama-cpp.
 *
 * This provider runs LLM inference directly in-process. Models are loaded
 * from local .gguf files via node-llama-cpp.
 */

import type {
  InferenceProvider,
  ChatStreamOptions,
  ChatStreamChunk,
  ModelInfo,
  EmbeddingResult,
} from './types.js';
import { llamaEngine } from '../llama-engine.js';

export class LlamaCppProvider implements InferenceProvider {
  readonly id = 'llamacpp' as const;
  readonly displayName = 'Liminal AI (Local)';

  async *chatStream(
    options: ChatStreamOptions,
    signal?: AbortSignal,
  ): AsyncGenerator<ChatStreamChunk> {
    const modelName = options.model;

    // Ensure model is loaded
    const model = await llamaEngine.loadModel(modelName);
    const context = await llamaEngine.getContext(modelName, options.options?.num_ctx);

    // Import node-llama-cpp lazily
    const nodeLlamaCpp = await import('node-llama-cpp');

    // Build chat session — node-llama-cpp uses private constructors that
    // require indirect typing for the contextSequence parameter.
    const contextObj = context as { getSequence: () => unknown };
    const LlamaChatSessionCtor = nodeLlamaCpp.LlamaChatSession as unknown as
      new (opts: { contextSequence: unknown }) => { prompt: (text: string, opts?: Record<string, unknown>) => Promise<string>; dispose?: () => void };
    const session = new LlamaChatSessionCtor({
      contextSequence: contextObj.getSequence(),
    });

    // Load prior messages into the session as conversation history
    const systemMessages = options.messages.filter((m) => m.role === 'system');
    const systemPrompt = systemMessages.map((m) =>
      typeof m.content === 'string' ? m.content : '',
    ).join('\n');

    if (systemPrompt) {
      const sessionWithSystem = session as unknown as { setChatSystemPrompt?: (p: string) => void };
      sessionWithSystem.setChatSystemPrompt?.(systemPrompt);
    }

    // Build the user prompt from the last user message
    const nonSystemMessages = options.messages.filter((m) => m.role !== 'system');
    const lastUserMessage = [...nonSystemMessages].reverse().find((m) => m.role === 'user');
    const userPrompt = lastUserMessage
      ? (typeof lastUserMessage.content === 'string'
          ? lastUserMessage.content
          : JSON.stringify(lastUserMessage.content))
      : '';

    // Prepare images for multimodal models
    const images: Buffer[] = [];
    if (lastUserMessage?.images) {
      for (const img of lastUserMessage.images) {
        images.push(Buffer.from(img, 'base64'));
      }
    }

    // Token tracking
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let fullContent = '';

    // Stream the response
    try {
      const response = await session.prompt(userPrompt, {
        signal,
        maxTokens: options.options?.num_predict ?? -1,
        temperature: options.options?.temperature ?? 0.7,
        topP: options.options?.top_p,
        onTextChunk: (chunk: string) => {
          // This callback is called synchronously — we'll buffer and yield below
        },
      });

      // Since onTextChunk is sync and we need an async generator,
      // we use a different approach: prompt() returns the full response,
      // and we simulate streaming by chunking the output.
      fullContent = response;

      // Estimate token counts
      totalPromptTokens = Math.ceil(userPrompt.length / 4);
      totalCompletionTokens = Math.ceil(fullContent.length / 4);

      // Simulate streaming by yielding chunks
      const chunkSize = 4; // characters per chunk for smooth streaming feel
      for (let i = 0; i < fullContent.length; i += chunkSize) {
        if (signal?.aborted) break;

        const delta = fullContent.slice(i, i + chunkSize);
        yield {
          model: modelName,
          created_at: new Date().toISOString(),
          message: {
            role: 'assistant',
            content: delta,
          },
          done: false,
        };
      }

      // Final chunk with done=true and token counts
      yield {
        model: modelName,
        created_at: new Date().toISOString(),
        message: {
          role: 'assistant',
          content: '',
        },
        done: true,
        done_reason: 'stop',
        prompt_eval_count: totalPromptTokens,
        eval_count: totalCompletionTokens,
      };
    } catch (err) {
      if (signal?.aborted) return;

      // Yield error as final chunk
      yield {
        model: modelName,
        created_at: new Date().toISOString(),
        message: {
          role: 'assistant',
          content: `[Error: ${err instanceof Error ? err.message : String(err)}]`,
        },
        done: true,
        done_reason: 'error',
      };
    } finally {
      // Dispose session to free context sequence
      (session as unknown as { dispose?: () => void }).dispose?.();
    }
  }

  async chat(options: ChatStreamOptions): Promise<ChatStreamChunk> {
    let lastChunk: ChatStreamChunk | null = null;
    let fullContent = '';

    for await (const chunk of this.chatStream(options)) {
      fullContent += chunk.message.content;
      if (chunk.done) {
        lastChunk = chunk;
      }
    }

    if (!lastChunk) {
      throw new Error('No response received from model');
    }

    return {
      ...lastChunk,
      message: {
        ...lastChunk.message,
        content: fullContent,
      },
    };
  }

  async listModels(): Promise<ModelInfo[]> {
    const models = llamaEngine.listModels();
    return models.map((m) => ({
      name: m.name,
      size: m.size,
      modified_at: m.modifiedAt,
    }));
  }

  async checkModel(name: string): Promise<boolean> {
    return llamaEngine.checkModel(name);
  }

  async embed(text: string, model?: string): Promise<EmbeddingResult> {
    const embedModel = model
      ?? process.env['LIMINAL_EMBED_MODEL']
      ?? 'nomic-embed-text-v1.5.Q8_0';

    const embeddingCtx = await llamaEngine.getEmbeddingContext(embedModel);
    const ctxTyped = embeddingCtx as {
      getEmbeddingFor: (text: string) => Promise<{ vector: number[] }>;
    };

    const result = await ctxTyped.getEmbeddingFor(text);
    return { embedding: Array.from(result.vector) };
  }

  async healthCheck(): Promise<boolean> {
    // Always healthy — local, no network dependency
    // But verify the engine can initialize
    try {
      await llamaEngine.ensureInitialized();
      return true;
    } catch {
      return false;
    }
  }
}
