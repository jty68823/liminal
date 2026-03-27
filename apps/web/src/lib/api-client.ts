const API_BASE = '/api/v1';

function headers(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `HTTP ${res.status}: ${res.statusText}`;
    try {
      const body = await res.json();
      message = body.message ?? body.error ?? message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  // 204 No Content
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface ConversationCreateRequest {
  title?: string;
  model?: string;
  systemPrompt?: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  model?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationDetail extends ConversationSummary {
  messages: MessageSummary[];
}

export interface MessageSummary {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface MessageSendRequest {
  message: string;
  conversation_id?: string | null;
  model?: string;
  stream?: boolean;
}

export const api = {
  conversations: {
    list: (): Promise<ConversationSummary[]> =>
      fetch(`${API_BASE}/conversations`, { headers: headers() }).then((r) =>
        handleResponse<ConversationSummary[]>(r)
      ),

    get: (id: string): Promise<ConversationDetail> =>
      fetch(`${API_BASE}/conversations/${id}`, { headers: headers() }).then((r) =>
        handleResponse<ConversationDetail>(r)
      ),

    create: (data: ConversationCreateRequest): Promise<ConversationSummary> =>
      fetch(`${API_BASE}/conversations`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(data),
      }).then((r) => handleResponse<ConversationSummary>(r)),

    update: (
      id: string,
      data: Partial<ConversationCreateRequest>
    ): Promise<ConversationSummary> =>
      fetch(`${API_BASE}/conversations/${id}`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify(data),
      }).then((r) => handleResponse<ConversationSummary>(r)),

    delete: (id: string): Promise<void> =>
      fetch(`${API_BASE}/conversations/${id}`, {
        method: 'DELETE',
        headers: headers(),
      }).then((r) => handleResponse<void>(r)),
  },

  messages: {
    send: (data: MessageSendRequest): Promise<Response> =>
      fetch(`${API_BASE}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(data),
      }),

    list: (conversationId: string): Promise<MessageSummary[]> =>
      fetch(`${API_BASE}/conversations/${conversationId}/messages`, {
        headers: headers(),
      }).then((r) => handleResponse<MessageSummary[]>(r)),
  },

  health: {
    check: (): Promise<{ status: string }> =>
      fetch(`${API_BASE}/health`).then((r) =>
        handleResponse<{ status: string }>(r)
      ),
  },
};
