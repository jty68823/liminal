/**
 * OpenAI-compatible provider.
 *
 * Supports OpenAI, OpenRouter, Together AI, vLLM, and any other endpoint
 * that speaks the OpenAI chat completions API.
 */

import type {
  InferenceProvider,
  ChatStreamOptions,
  ChatStreamChunk,
  ChatMessage,
  ChatTool,
  ModelInfo,
  EmbeddingResult,
} from './types.js';

interface OpenAIMessage {
  role: string;
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
}

interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface OpenAIChatCompletionChunk {
  id: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string | null;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIChatCompletion {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenAICompatProvider implements InferenceProvider {
  readonly id = 'openai-compat' as const;
  readonly displayName: string;
  private baseUrl: string;
  private apiKey: string;
  private headers: Record<string, string>;

  constructor(config: {
    baseUrl: string;
    apiKey?: string;
    displayName?: string;
    headers?: Record<string, string>;
  }) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey ?? '';
    this.displayName = config.displayName ?? 'OpenAI Compatible';
    this.headers = config.headers ?? {};
  }

  private getHeaders(): Record<string, string> {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.headers,
    };
    if (this.apiKey) {
      h['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return h;
  }

  private toOpenAIMessages(messages: ChatMessage[]): OpenAIMessage[] {
    return messages.map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.tool_calls
        ? {
            tool_calls: m.tool_calls.map((tc, i) => ({
              id: `call_${i}`,
              type: 'function' as const,
              function: {
                name: tc.function.name,
                arguments: JSON.stringify(tc.function.arguments),
              },
            })),
          }
        : {}),
    }));
  }

  private toOpenAITools(tools: ChatTool[]): OpenAITool[] {
    return tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      },
    }));
  }

  async *chatStream(
    options: ChatStreamOptions,
    signal?: AbortSignal,
  ): AsyncGenerator<ChatStreamChunk> {
    const body: Record<string, unknown> = {
      model: options.model,
      messages: this.toOpenAIMessages(options.messages),
      stream: true,
    };

    if (options.tools && options.tools.length > 0) {
      body.tools = this.toOpenAITools(options.tools);
    }

    if (options.options?.temperature !== undefined) {
      body.temperature = options.options.temperature;
    }
    if (options.options?.top_p !== undefined) {
      body.top_p = options.options.top_p;
    }
    if (options.options?.num_predict !== undefined) {
      body.max_tokens = options.options.num_predict;
    }

    // Ollama-specific performance options (ignored by non-Ollama endpoints)
    // num_ctx: smaller context window = faster prompt eval
    // keep_alive: keep model loaded in VRAM between requests (avoid reload)
    if (options.options?.num_ctx !== undefined) {
      body.num_ctx = options.options.num_ctx;
    } else {
      // Default to 4096 for faster inference — most conversations fit easily
      body.num_ctx = 4096;
    }
    // Keep model loaded for 30 minutes to avoid cold-start reload
    body.keep_alive = '30m';

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') throw err;
      throw new Error(`Failed to connect to ${this.baseUrl}: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '(no body)');
      throw new Error(`OpenAI API error ${response.status}: ${text}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Response body is null');

    const decoder = new TextDecoder();
    let buffer = '';

    // Track accumulated tool calls across stream chunks
    const accumulatedToolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map();
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') {
            if (trimmed === 'data: [DONE]') {
              // Emit final chunk
              const toolCalls = accumulatedToolCalls.size > 0
                ? Array.from(accumulatedToolCalls.values()).map((tc) => ({
                    function: {
                      name: tc.name,
                      arguments: (() => { try { return JSON.parse(tc.arguments); } catch { return {}; } })(),
                    },
                  }))
                : undefined;

              yield {
                model: options.model,
                message: { role: 'assistant', content: '', tool_calls: toolCalls },
                done: true,
                done_reason: toolCalls ? 'tool_calls' : 'stop',
                prompt_eval_count: totalPromptTokens,
                eval_count: totalCompletionTokens,
              };
              return;
            }
            continue;
          }

          if (!trimmed.startsWith('data: ')) continue;
          const jsonStr = trimmed.slice(6);

          let chunk: OpenAIChatCompletionChunk;
          try {
            chunk = JSON.parse(jsonStr) as OpenAIChatCompletionChunk;
          } catch {
            continue;
          }

          if (chunk.usage) {
            totalPromptTokens = chunk.usage.prompt_tokens;
            totalCompletionTokens = chunk.usage.completion_tokens;
          }

          const choice = chunk.choices[0];
          if (!choice) continue;

          // Handle streamed tool calls (accumulated across chunks)
          if (choice.delta.tool_calls) {
            for (const tc of choice.delta.tool_calls) {
              const existing = accumulatedToolCalls.get(tc.index);
              if (existing) {
                if (tc.function?.arguments) {
                  existing.arguments += tc.function.arguments;
                }
              } else {
                accumulatedToolCalls.set(tc.index, {
                  id: tc.id ?? `call_${tc.index}`,
                  name: tc.function?.name ?? '',
                  arguments: tc.function?.arguments ?? '',
                });
              }
            }
          }

          // Handle text content
          const content = choice.delta.content ?? '';
          if (content) {
            yield {
              model: options.model,
              message: { role: 'assistant', content },
              done: false,
            };
          }

          // Handle finish reason
          if (choice.finish_reason) {
            const toolCalls = accumulatedToolCalls.size > 0
              ? Array.from(accumulatedToolCalls.values()).map((tc) => ({
                  function: {
                    name: tc.name,
                    arguments: (() => { try { return JSON.parse(tc.arguments); } catch { return {}; } })(),
                  },
                }))
              : undefined;

            yield {
              model: options.model,
              message: { role: 'assistant', content: '', tool_calls: toolCalls },
              done: true,
              done_reason: choice.finish_reason === 'tool_calls' ? 'tool_calls' : choice.finish_reason,
              prompt_eval_count: totalPromptTokens,
              eval_count: totalCompletionTokens,
            };
            return;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async chat(options: ChatStreamOptions): Promise<ChatStreamChunk> {
    const body: Record<string, unknown> = {
      model: options.model,
      messages: this.toOpenAIMessages(options.messages),
      stream: false,
    };

    if (options.tools && options.tools.length > 0) {
      body.tools = this.toOpenAITools(options.tools);
    }

    if (options.options?.temperature !== undefined) {
      body.temperature = options.options.temperature;
    }
    if (options.options?.top_p !== undefined) {
      body.top_p = options.options.top_p;
    }
    if (options.options?.num_predict !== undefined) {
      body.max_tokens = options.options.num_predict;
    }

    // Ollama-specific performance options
    if (options.options?.num_ctx !== undefined) {
      body.num_ctx = options.options.num_ctx;
    } else {
      body.num_ctx = 4096;
    }
    body.keep_alive = '30m';

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '(no body)');
      throw new Error(`OpenAI API error ${response.status}: ${text}`);
    }

    const data = (await response.json()) as OpenAIChatCompletion;
    const choice = data.choices[0];

    const toolCalls = choice.message.tool_calls?.map((tc) => ({
      function: {
        name: tc.function.name,
        arguments: (() => { try { return JSON.parse(tc.function.arguments); } catch { return {}; } })(),
      },
    }));

    return {
      model: options.model,
      message: {
        role: 'assistant',
        content: choice.message.content ?? '',
        tool_calls: toolCalls,
      },
      done: true,
      done_reason: choice.finish_reason,
      prompt_eval_count: data.usage?.prompt_tokens ?? 0,
      eval_count: data.usage?.completion_tokens ?? 0,
    };
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/models`, {
        headers: this.getHeaders(),
      });
      if (!response.ok) return [];
      const data = (await response.json()) as { data: Array<{ id: string; created?: number }> };
      return (data.data ?? []).map((m) => ({
        name: m.id,
        size: 0,
        modified_at: m.created ? new Date(m.created * 1000).toISOString() : new Date().toISOString(),
      }));
    } catch {
      return [];
    }
  }

  async checkModel(name: string): Promise<boolean> {
    const models = await this.listModels();
    const target = name.toLowerCase();
    return models.some((m) => m.name.toLowerCase() === target);
  }

  async embed(text: string, model?: string): Promise<EmbeddingResult> {
    const response = await fetch(`${this.baseUrl}/v1/embeddings`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: model ?? 'text-embedding-3-small',
        input: text,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '(no body)');
      throw new Error(`Embedding error ${response.status}: ${body}`);
    }

    const data = (await response.json()) as { data: Array<{ embedding: number[] }> };
    return { embedding: data.data[0].embedding };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/models`, {
        headers: this.getHeaders(),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
