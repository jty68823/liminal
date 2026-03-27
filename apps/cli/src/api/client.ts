/**
 * CLI-specific API client.
 *
 * Wraps fetch() calls to the Liminal API server and handles
 * SSE streaming for chat messages.
 */

export interface SendMessageOptions {
  content: string;
  conversationId?: string;
  projectId?: string;
  model?: string;
}

export interface SendMessageCallbacks {
  onToken(delta: string): void;
  onThinking(delta: string): void;
  onToolCallStart(id: string, name: string, input: unknown): void;
  onToolCallResult(id: string, output: string, isError: boolean): void;
  onArtifact(id: string, artifact: unknown): void;
  onDone(messageId: string, conversationId: string): void;
  onError(message: string): void;
}

export interface ConversationSummary {
  id: string;
  title: string | null;
  model: string;
  project_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ModelInfo {
  name: string;
  display_name: string;
  size: number;
  modified_at: string;
  context_length: number | null;
  is_default: boolean;
  task_types: string[];
}

export class ApiClient {
  constructor(private readonly baseUrl: string) {}

  /**
   * Send a user message and stream the assistant response via SSE.
   * Resolves when the stream is complete (done or error event received).
   */
  async sendMessage(
    options: SendMessageOptions,
    callbacks: SendMessageCallbacks,
  ): Promise<void> {
    const body: Record<string, unknown> = {
      content: options.content,
    };
    if (options.conversationId) body['conversation_id'] = options.conversationId;
    if (options.projectId) body['project_id'] = options.projectId;
    if (options.model) body['model_override'] = options.model;

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/v1/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      callbacks.onError(`Network error: ${msg}`);
      return;
    }

    if (!response.ok) {
      let details = '';
      try {
        const j = await response.json() as { error?: string };
        details = j.error ?? '';
      } catch {
        // ignore
      }
      callbacks.onError(`API error ${response.status}${details ? ': ' + details : ''}`);
      return;
    }

    if (!response.body) {
      callbacks.onError('Response has no body');
      return;
    }

    // Parse the SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by double newlines
      const events = buffer.split('\n\n');
      // The last element may be an incomplete event; keep it in the buffer
      buffer = events.pop() ?? '';

      for (const raw of events) {
        const lines = raw.split('\n');
        let dataLine = '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            dataLine = line.slice(6);
          }
        }
        if (!dataLine) continue;

        let event: Record<string, unknown>;
        try {
          event = JSON.parse(dataLine) as Record<string, unknown>;
        } catch {
          continue;
        }

        const type = event['type'] as string;

        switch (type) {
          case 'token':
            callbacks.onToken((event['delta'] as string) ?? '');
            break;

          case 'thinking':
            callbacks.onThinking((event['delta'] as string) ?? '');
            break;

          case 'tool_call_start':
            callbacks.onToolCallStart(
              (event['id'] as string) ?? '',
              (event['name'] as string) ?? '',
              event['input'] ?? {},
            );
            break;

          case 'tool_call_result':
            callbacks.onToolCallResult(
              (event['id'] as string) ?? '',
              (event['output'] as string) ?? '',
              Boolean(event['is_error']),
            );
            break;

          case 'artifact':
            callbacks.onArtifact((event['id'] as string) ?? '', event['artifact']);
            break;

          case 'done':
            callbacks.onDone(
              (event['message_id'] as string) ?? '',
              (event['conversation_id'] as string) ?? '',
            );
            // Stream is complete
            return;

          case 'error':
            callbacks.onError((event['message'] as string) ?? 'Unknown error');
            return;
        }
      }
    }
  }

  /**
   * List all conversations (paginated, returns first page by default).
   */
  async listConversations(limit = 50, offset = 0): Promise<ConversationSummary[]> {
    const url = `${this.baseUrl}/api/v1/conversations?limit=${limit}&offset=${offset}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to list conversations: ${response.status}`);
    }
    const data = await response.json() as { conversations: ConversationSummary[] };
    return data.conversations ?? [];
  }

  /**
   * List all models available from the Liminal AI engine.
   */
  async listModels(): Promise<ModelInfo[]> {
    const url = `${this.baseUrl}/api/v1/models`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to list models: ${response.status}`);
    }
    const data = await response.json() as { models: ModelInfo[] };
    return data.models ?? [];
  }

  /**
   * Check if the API server is reachable.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(3000) });
      return response.ok;
    } catch {
      return false;
    }
  }
}
