import type { Artifact } from '@/store/artifact.store';

export interface StreamCallbacks {
  onToken: (delta: string) => void;
  onThinking: (delta: string) => void;
  onToolCallStart: (id: string, name: string, input: Record<string, unknown>) => void;
  onToolCallResult: (id: string, output: unknown, isError: boolean) => void;
  onArtifact: (artifact: Artifact) => void;
  onSubAgentResult?: (result: { role: string; status: 'success' | 'error'; output: string; durationMs: number }) => void;
  onDone: (messageId: string | null, conversationId: string | null) => void;
  onError: (message: string) => void;
}

export interface SendBody {
  content: string;
  conversationId?: string | null;
  model?: string;
  systemPrompt?: string;
  images?: string[];
}

function parseSSELine(line: string): { event?: string; data?: string } | null {
  if (line.startsWith('event:')) {
    return { event: line.slice(6).trim() };
  }
  if (line.startsWith('data:')) {
    return { data: line.slice(5).trim() };
  }
  return null;
}

async function processStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  callbacks: StreamCallbacks
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = 'message';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    // Keep the last (potentially incomplete) line in buffer
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed === '') {
        // Empty line signals end of event
        currentEvent = 'message';
        continue;
      }

      const parsed = parseSSELine(trimmed);
      if (!parsed) continue;

      if (parsed.event !== undefined) {
        currentEvent = parsed.event;
        continue;
      }

      if (parsed.data !== undefined) {
        const rawData = parsed.data;

        if (rawData === '[DONE]') {
          return;
        }

        try {
          const json = JSON.parse(rawData);
          handleEvent(currentEvent, json, callbacks);
        } catch {
          // Not JSON, treat as raw text token for backward compat
          if (currentEvent === 'message' || currentEvent === 'token') {
            callbacks.onToken(rawData);
          }
        }
      }
    }
  }
}

function handleEvent(
  event: string,
  data: Record<string, unknown>,
  callbacks: StreamCallbacks
): void {
  // Server embeds event type in data.type when no SSE event: header is sent
  const effectiveEvent = typeof data.type === 'string' ? data.type : event;

  switch (effectiveEvent) {
    case 'token':
    case 'content_block_delta': {
      // Support both formats
      const delta = (data.delta as { type?: string; text?: string }) ?? {};
      if (delta.type === 'text_delta' && typeof delta.text === 'string') {
        callbacks.onToken(delta.text);
      } else if (typeof data.text === 'string') {
        callbacks.onToken(data.text);
      } else if (typeof data.delta === 'string') {
        callbacks.onToken(data.delta);
      }
      break;
    }

    case 'thinking': {
      // Server sends { type: 'thinking', delta: string }
      // Anthropic format sends { delta: { type: 'thinking_block_delta', thinking: string } }
      if (typeof data.delta === 'string') {
        callbacks.onThinking(data.delta);
      } else {
        const delta = (data.delta as { type?: string; thinking?: string }) ?? {};
        if (typeof delta.thinking === 'string') {
          callbacks.onThinking(delta.thinking);
        } else if (typeof data.content === 'string') {
          callbacks.onThinking(data.content);
        }
      }
      break;
    }

    case 'tool_call_start': {
      const id = typeof data.id === 'string' ? data.id : String(data.id ?? '');
      const name = typeof data.name === 'string' ? data.name : '';
      const input = (data.input as Record<string, unknown>) ?? {};
      callbacks.onToolCallStart(id, name, input);
      break;
    }

    case 'tool_call_result': {
      const id = typeof data.id === 'string' ? data.id : String(data.id ?? '');
      const isError = Boolean(data.isError ?? data.is_error);
      callbacks.onToolCallResult(id, data.output ?? data.result, isError);
      break;
    }

    case 'artifact': {
      // Server sends { type: 'artifact', id, action, artifact: { id, type, language, ... } }
      const artifactData = data.artifact as Record<string, unknown> | undefined;
      if (artifactData) {
        const artifact: import('@/store/artifact.store').Artifact = {
          id: typeof artifactData.id === 'string' ? artifactData.id : String(data.id ?? ''),
          type: (artifactData.type as 'code' | 'html' | 'mermaid' | 'react' | 'svg' | 'markdown' | 'text') ?? 'code',
          language: (artifactData.language as string | undefined) ?? undefined,
          title: (artifactData.title as string) ?? '',
          content: typeof artifactData.content === 'string' ? artifactData.content : '',
        };
        callbacks.onArtifact(artifact);
      }
      break;
    }

    case 'sub_agent_result': {
      const result = {
        role: typeof data.role === 'string' ? data.role : 'agent',
        status: (data.status === 'error' ? 'error' : 'success') as 'success' | 'error',
        output: typeof data.output === 'string' ? data.output : JSON.stringify(data.output ?? ''),
        durationMs: typeof data.durationMs === 'number' ? data.durationMs : 0,
      };
      callbacks.onSubAgentResult?.(result);
      break;
    }

    case 'done':
    case 'message_stop': {
      const messageId =
        typeof data.messageId === 'string'
          ? data.messageId
          : typeof data.message_id === 'string'
          ? data.message_id
          : null;
      const conversationId =
        typeof data.conversationId === 'string'
          ? data.conversationId
          : typeof data.conversation_id === 'string'
          ? data.conversation_id
          : null;
      callbacks.onDone(messageId, conversationId);
      break;
    }

    case 'error': {
      const message =
        typeof data.message === 'string'
          ? data.message
          : 'An error occurred during streaming';
      callbacks.onError(message);
      break;
    }

    default:
      // Unknown event, silently ignore
      break;
  }
}

// Export as a factory function that returns the send function
// (not a React hook since it doesn't use any React hooks internally)
export function useStream() {
  const send = async (body: SendBody, callbacks: StreamCallbacks): Promise<void> => {
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

    try {
      const response = await fetch('/api/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          content: body.content,
          images: body.images,
          conversation_id: body.conversationId,
          model_override: body.model,
          stream: true,
        }),
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errData = await response.json();
          errorMessage = errData.message ?? errData.error ?? errorMessage;
        } catch {
          // ignore parse error
        }
        callbacks.onError(errorMessage);
        return;
      }

      if (!response.body) {
        callbacks.onError('Response has no body');
        return;
      }

      reader = response.body.getReader();
      await processStream(reader, callbacks);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown streaming error';
      callbacks.onError(message);
    } finally {
      if (reader) {
        try {
          await reader.cancel();
        } catch {
          // ignore cancel error
        }
      }
    }
  };

  return { send };
}
