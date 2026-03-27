import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { api } from '@/lib/api-client';
import { useArtifactStore } from '@/store/artifact.store';

// ── Token batching ──────────────────────────────────────────────────
// Accumulates streaming and thinking tokens between animation frames
// so the Zustand store updates at most ~60 times/sec instead of per-token.
let _streamBuf = '';
let _thinkBuf = '';
let _batchRaf: number | null = null;
// The store reference is assigned after create() below to avoid TDZ issues.
let _storeRef: typeof useChatStore | null = null;

function _flushTokenBatch() {
  _batchRaf = null;
  const sd = _streamBuf;
  const td = _thinkBuf;
  _streamBuf = '';
  _thinkBuf = '';

  if ((sd || td) && _storeRef) {
    const state = _storeRef.getState();
    // Compute new state in one set() call
    const patch: Record<string, unknown> = {};
    if (sd) {
      patch.streamingContent = state.streamingContent + sd;
      patch.isThinking = false;
    }
    if (td) {
      patch.thinkingContent = state.thinkingContent + td;
      patch.isThinking = true;
    }
    // If both arrived in the same frame, streaming takes priority for isThinking flag
    if (sd && td) {
      patch.isThinking = false;
    }
    _storeRef.setState(patch);
  }
}
// ────────────────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant';

export interface SubAgentResult {
  role: string;
  status: 'success' | 'error';
  output: string;
  durationMs: number;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: unknown;
  isError?: boolean;
  isPending?: boolean;
}

export interface ThinkingBlock {
  type: 'thinking';
  content: string;
}

export interface Artifact {
  id: string;
  type: 'code' | 'html' | 'mermaid' | 'react' | 'svg' | 'markdown' | 'text';
  title: string;
  language?: string;
  content: string;
  version?: number;
}

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  images?: string[];
  thinking?: ThinkingBlock[];
  toolCalls?: ToolCall[];
  artifacts?: Artifact[];
  subAgentResults?: SubAgentResult[];
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  model?: string;
}

interface ChatStore {
  conversations: Conversation[];
  currentConversationId: string | null;
  messages: Message[];
  isStreaming: boolean;
  streamingContent: string;
  streamingMessageId: string | null;
  thinkingContent: string;
  isThinking: boolean;
  pendingToolCalls: ToolCall[];
  pendingSubAgentResults: SubAgentResult[];
  pendingArtifacts: Artifact[];
  autonomousProgress: {
    taskId: string;
    iteration: number;
    maxIterations: number;
    phase: string;
    action?: string;
    screenshotBase64?: string;
    analysis?: string;
    goalMet: boolean;
  } | null;

  // Actions
  setCurrentConversation(id: string): void;
  addMessage(message: Message): void;
  updateMessage(id: string, update: Partial<Message>): void;
  appendStreamingToken(delta: string): void;
  appendThinkingToken(delta: string): void;
  finalizeStreamingMessage(messageId: string): void;
  addToolCallResult(callId: string, result: unknown, isError: boolean): void;
  addPendingToolCall(toolCall: ToolCall): void;
  addPendingArtifact(artifact: Artifact): void;
  setAutonomousProgress(progress: ChatStore['autonomousProgress']): void;
  clearPendingToolCalls(): void;
  addSubAgentResult(result: SubAgentResult): void;
  loadConversations(): Promise<void>;
  loadMessages(conversationId: string): Promise<void>;
  sendMessage(content: string, images?: string[], conversationId?: string | null): Promise<void>;
  setStreaming(val: boolean): void;
  reset(): void;
  currentProjectId: string | null;
  setCurrentProjectId(id: string | null): void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  conversations: [],
  currentConversationId: null,
  messages: [],
  isStreaming: false,
  streamingContent: '',
  streamingMessageId: null,
  thinkingContent: '',
  isThinking: false,
  pendingToolCalls: [],
  pendingSubAgentResults: [],
  pendingArtifacts: [],
  autonomousProgress: null,
  currentProjectId: null,

  setCurrentProjectId(id) {
    set({ currentProjectId: id });
  },

  setCurrentConversation(id) {
    const current = get().currentConversationId;
    if (current !== id) {
      set({
        currentConversationId: id,
        messages: [],
        streamingContent: '',
        streamingMessageId: null,
        isStreaming: false,
        thinkingContent: '',
        isThinking: false,
        pendingToolCalls: [],
        pendingSubAgentResults: [],
        pendingArtifacts: [],
      });
      get().loadMessages(id);
    }
  },

  addMessage(message) {
    set((state) => ({ messages: [...state.messages, message] }));
  },

  updateMessage(id, update) {
    set((state) => ({
      messages: state.messages.map((m) => (m.id === id ? { ...m, ...update } : m)),
    }));
  },

  appendStreamingToken(delta) {
    _streamBuf += delta;
    if (_batchRaf === null) {
      _batchRaf = requestAnimationFrame(() => _flushTokenBatch());
    }
  },

  appendThinkingToken(delta) {
    _thinkBuf += delta;
    if (_batchRaf === null) {
      _batchRaf = requestAnimationFrame(() => _flushTokenBatch());
    }
  },

  finalizeStreamingMessage(messageId) {
    // Flush any pending batched tokens before finalizing
    if (_batchRaf !== null) {
      cancelAnimationFrame(_batchRaf);
      _batchRaf = null;
    }
    // Apply any remaining buffered tokens synchronously
    const bufferedStream = _streamBuf;
    const bufferedThink = _thinkBuf;
    _streamBuf = '';
    _thinkBuf = '';

    const { streamingContent, thinkingContent, pendingToolCalls, pendingSubAgentResults, pendingArtifacts, currentConversationId } = get();
    const finalStreamContent = streamingContent + bufferedStream;
    const finalThinkContent = thinkingContent + bufferedThink;

    const finalMessage: Message = {
      id: messageId,
      conversationId: currentConversationId ?? '',
      role: 'assistant',
      content: finalStreamContent,
      thinking:
        finalThinkContent
          ? [{ type: 'thinking', content: finalThinkContent }]
          : undefined,
      toolCalls: pendingToolCalls.length > 0 ? [...pendingToolCalls] : undefined,
      artifacts: pendingArtifacts.length > 0 ? [...pendingArtifacts] : undefined,
      subAgentResults: pendingSubAgentResults.length > 0 ? [...pendingSubAgentResults] : undefined,
      createdAt: new Date().toISOString(),
    };
    set((state) => ({
      messages: [...state.messages, finalMessage],
      isStreaming: false,
      streamingContent: '',
      streamingMessageId: null,
      thinkingContent: '',
      isThinking: false,
      pendingToolCalls: [],
      pendingSubAgentResults: [],
      pendingArtifacts: [],
    }));
  },

  addToolCallResult(callId, result, isError) {
    set((state) => ({
      pendingToolCalls: state.pendingToolCalls.map((tc) =>
        tc.id === callId ? { ...tc, result, isError, isPending: false } : tc
      ),
    }));
  },

  addPendingToolCall(toolCall) {
    set((state) => ({ pendingToolCalls: [...state.pendingToolCalls, toolCall] }));
  },

  addPendingArtifact(artifact) {
    set((state) => ({ pendingArtifacts: [...state.pendingArtifacts, artifact] }));
  },

  setAutonomousProgress(progress) {
    set({ autonomousProgress: progress });
  },

  clearPendingToolCalls() {
    set({ pendingToolCalls: [] });
  },

  addSubAgentResult(result) {
    set((state) => ({ pendingSubAgentResults: [...state.pendingSubAgentResults, result] }));
  },

  setStreaming(val) {
    set({ isStreaming: val });
  },

  reset() {
    // Cancel any pending RAF batch
    if (_batchRaf !== null) {
      cancelAnimationFrame(_batchRaf);
      _batchRaf = null;
    }
    _streamBuf = '';
    _thinkBuf = '';
    set({
      messages: [],
      streamingContent: '',
      streamingMessageId: null,
      isStreaming: false,
      thinkingContent: '',
      isThinking: false,
      pendingToolCalls: [],
      pendingSubAgentResults: [],
      pendingArtifacts: [],
    });
  },

  async loadConversations() {
    try {
      const data = await api.conversations.list();
      if (Array.isArray(data)) {
        set({ conversations: data });
      } else if (data && typeof data === 'object' && 'conversations' in data && Array.isArray((data as Record<string, unknown>).conversations)) {
        set({ conversations: (data as { conversations: Conversation[] }).conversations });
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  },

  async loadMessages(conversationId) {
    try {
      const data = await api.conversations.get(conversationId);
      if (data?.messages) {
        set({ messages: data.messages });
      } else if (Array.isArray(data)) {
        set({ messages: data });
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  },

  async sendMessage(content, images, conversationId) {
    const store = get();
    const effectiveConvId = conversationId ?? store.currentConversationId;

    // Add user message optimistically
    const userMessage: Message = {
      id: nanoid(),
      conversationId: effectiveConvId ?? '',
      role: 'user',
      content,
      images: images && images.length > 0 ? images : undefined,
      createdAt: new Date().toISOString(),
    };
    store.addMessage(userMessage);

    // Set up streaming state — cancel any prior stream's pending batch
    if (_batchRaf !== null) {
      cancelAnimationFrame(_batchRaf);
      _batchRaf = null;
    }
    _streamBuf = '';
    _thinkBuf = '';

    const streamingId = nanoid();
    set({
      isStreaming: true,
      streamingContent: '',
      streamingMessageId: streamingId,
      thinkingContent: '',
      isThinking: false,
      pendingToolCalls: [],
      pendingSubAgentResults: [],
      pendingArtifacts: [],
    });

    try {
      const { useStream } = await import('@/hooks/useStream');
      const { send } = useStream();

      await send(
        {
          content,
          images,
          conversationId: effectiveConvId,
        },
        {
          onToken: (delta) => get().appendStreamingToken(delta),
          onThinking: (delta) => get().appendThinkingToken(delta),
          onToolCallStart: (id, name, input) => {
            get().addPendingToolCall({ id, name, input, isPending: true });
          },
          onToolCallResult: (id, output, isError) => {
            get().addToolCallResult(id, output, isError);
          },
          onSubAgentResult: (result) => {
            get().addSubAgentResult(result);
          },
          onArtifact: (artifact) => {
            useArtifactStore.getState().setArtifact(artifact);
            get().addPendingArtifact(artifact);
          },
          onDone: (messageId, newConversationId) => {
            if (newConversationId && !effectiveConvId) {
              set({ currentConversationId: newConversationId });
            }
            get().finalizeStreamingMessage(messageId ?? streamingId);
            // Refresh conversations list to update titles
            get().loadConversations();
          },
          onError: (message) => {
            console.error('Stream error:', message);
            set({ isStreaming: false, streamingContent: '' });
          },
        }
      );
    } catch (err) {
      console.error('Failed to send message:', err);
      set({ isStreaming: false, streamingContent: '' });
    }
  },
}));

// Wire up the store reference for the token batching flush function
_storeRef = useChatStore;
