import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Text, useInput, useApp, Static } from 'ink';
import { ApiClient } from '../api/client.js';
import { createSession } from '../session/session.js';
import { parseCommand, commands } from '../commands/index.js';
import { CLEAR_SIGNAL } from '../commands/clear.js';
import { COMPACT_SIGNAL_PREFIX } from '../commands/compact.js';
import { renderToolCall, renderThinking } from './renderer.js';
import type { Session } from '../session/session.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReplOptions {
  initialPrompt?: string;
  model?: string;
  apiUrl?: string;
}

type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  /** Rendered text that includes ANSI codes (tool calls, thinking, etc.) */
  rendered?: string;
}

interface ToolCallState {
  id: string;
  name: string;
  input: unknown;
  output: string | null;
  status: 'running' | 'done' | 'error';
}

// ---------------------------------------------------------------------------
// Small helper: generate simple IDs without external deps
// ---------------------------------------------------------------------------
function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ---------------------------------------------------------------------------
// Header component
// ---------------------------------------------------------------------------
interface HeaderProps {
  model: string;
  conversationId: string | null;
  apiUrl: string;
}

function Header({ model, conversationId, apiUrl }: HeaderProps) {
  const shortConvId = conversationId ? conversationId.slice(0, 8) : null;
  const host = (() => {
    try { return new URL(apiUrl).host; } catch { return apiUrl; }
  })();

  return (
    <Box
      borderStyle="single"
      borderColor="cyan"
      paddingX={1}
      justifyContent="space-between"
    >
      <Text bold color="cyan">Liminal</Text>
      <Box gap={2}>
        <Text color="gray">model: <Text color="white">{model}</Text></Text>
        {shortConvId && (
          <Text color="gray">conv: <Text color="white">#{shortConvId}</Text></Text>
        )}
        <Text color="gray">api: <Text color="white">{host}</Text></Text>
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Message display component
// ---------------------------------------------------------------------------
interface MessageItemProps {
  message: ChatMessage;
}

function MessageItem({ message }: MessageItemProps) {
  const { role, content, rendered } = message;
  const display = rendered ?? content;

  if (role === 'user') {
    return (
      <Box marginY={0} flexDirection="column">
        <Box>
          <Text bold color="blue">You: </Text>
          <Text wrap="wrap">{content}</Text>
        </Box>
      </Box>
    );
  }

  if (role === 'assistant') {
    return (
      <Box marginY={0} flexDirection="column">
        <Text bold color="cyan">{'Assistant: '}</Text>
        {/* Raw ANSI output from renderer — use Text with raw escape pass-through */}
        <Text wrap="wrap">{display}</Text>
      </Box>
    );
  }

  if (role === 'tool') {
    return (
      <Box marginY={0}>
        <Text dimColor>{display}</Text>
      </Box>
    );
  }

  // system
  return (
    <Box marginY={0}>
      <Text dimColor italic>{content}</Text>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Input component
// ---------------------------------------------------------------------------
interface InputAreaProps {
  value: string;
  disabled: boolean;
  status: string;
}

function InputArea({ value, disabled, status }: InputAreaProps) {
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1} marginTop={0}>
      {status ? (
        <Text dimColor>{status}</Text>
      ) : null}
      <Box>
        <Text color={disabled ? 'gray' : 'cyan'}>&gt; </Text>
        <Text>{value}</Text>
        {!disabled && <Text color="cyan" inverse> </Text>}
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Main App component
// ---------------------------------------------------------------------------
interface AppProps {
  options: ReplOptions;
}

export function App({ options }: AppProps) {
  const { exit } = useApp();

  const sessionRef = useRef<Session>(
    createSession({
      model: options.model,
      apiUrl: options.apiUrl,
    }),
  );
  const session = sessionRef.current;

  const apiClient = useRef<ApiClient>(new ApiClient(session.apiUrl)).current;

  // Completed messages rendered via Static (never re-rendered after commit)
  const [committedMessages, setCommittedMessages] = useState<ChatMessage[]>([]);

  // The message currently streaming (assistant or tool output)
  const [streamingContent, setStreamingContent] = useState<string>('');
  const [streamingThinking, setStreamingThinking] = useState<string>('');
  const [activeToolCalls, setActiveToolCalls] = useState<Map<string, ToolCallState>>(new Map());

  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [statusLine, setStatusLine] = useState('');

  // Refs to accumulate streaming text between React renders
  const streamingRef = useRef('');
  const thinkingRef = useRef('');
  const toolCallsRef = useRef<Map<string, ToolCallState>>(new Map());

  // ---------------------------------------------------------------------------
  // Commit assistant turn: move all accumulated streaming state to the
  // committedMessages list.
  // ---------------------------------------------------------------------------
  const commitAssistantTurn = useCallback(() => {
    const content = streamingRef.current;
    const thinking = thinkingRef.current;
    const tools = toolCallsRef.current;

    const parts: string[] = [];

    if (thinking.trim()) {
      parts.push(renderThinking(thinking));
    }

    for (const tc of tools.values()) {
      parts.push(renderToolCall(tc.name, tc.input, tc.output, tc.status));
    }

    if (content.trim()) {
      parts.push(content);
    }

    if (parts.length > 0) {
      const msg: ChatMessage = {
        id: uid(),
        role: 'assistant',
        content,
        rendered: parts.join('\n'),
      };
      setCommittedMessages((prev) => [...prev, msg]);
    }

    // Reset streaming state
    streamingRef.current = '';
    thinkingRef.current = '';
    toolCallsRef.current = new Map();
    setStreamingContent('');
    setStreamingThinking('');
    setActiveToolCalls(new Map());
  }, []);

  // ---------------------------------------------------------------------------
  // Send message
  // ---------------------------------------------------------------------------
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isSending) return;

      setIsSending(true);
      setStatusLine('Thinking…');

      const userMsg: ChatMessage = { id: uid(), role: 'user', content: text };
      setCommittedMessages((prev) => [...prev, userMsg]);

      await apiClient.sendMessage(
        {
          content: text,
          conversationId: session.conversationId ?? undefined,
          model: session.model,
        },
        {
          onToken(delta) {
            streamingRef.current += delta;
            setStreamingContent(streamingRef.current);
          },
          onThinking(delta) {
            thinkingRef.current += delta;
            setStreamingThinking(thinkingRef.current);
          },
          onToolCallStart(id, name, input) {
            const tc: ToolCallState = { id, name, input, output: null, status: 'running' };
            toolCallsRef.current = new Map(toolCallsRef.current).set(id, tc);
            setActiveToolCalls(new Map(toolCallsRef.current));
            setStatusLine(`Running tool: ${name}`);
          },
          onToolCallResult(id, output, isError) {
            const existing = toolCallsRef.current.get(id);
            if (existing) {
              const updated: ToolCallState = {
                ...existing,
                output,
                status: isError ? 'error' : 'done',
              };
              toolCallsRef.current = new Map(toolCallsRef.current).set(id, updated);
              setActiveToolCalls(new Map(toolCallsRef.current));
            }
            setStatusLine('Thinking…');
          },
          onArtifact(id, _artifact) {
            setStatusLine(`Artifact created: ${id}`);
          },
          onDone(_msgId, conversationId) {
            session.conversationId = conversationId;
            commitAssistantTurn();
            setStatusLine('');
            setIsSending(false);
          },
          onError(message) {
            const errMsg: ChatMessage = {
              id: uid(),
              role: 'system',
              content: `Error: ${message}`,
            };
            setCommittedMessages((prev) => [...prev, errMsg]);
            commitAssistantTurn();
            setStatusLine('');
            setIsSending(false);
          },
        },
      );
    },
    [isSending, session, apiClient, commitAssistantTurn],
  );

  // ---------------------------------------------------------------------------
  // Handle slash commands
  // ---------------------------------------------------------------------------
  const handleCommand = useCallback(
    async (input: string) => {
      const parsed = parseCommand(input);
      if (!parsed) return false;

      const cmd = commands.get(parsed.name);
      if (!cmd) {
        const sysMsg: ChatMessage = {
          id: uid(),
          role: 'system',
          content: `Unknown command: /${parsed.name}. Type /help for a list of commands.`,
        };
        setCommittedMessages((prev) => [...prev, sysMsg]);
        return true;
      }

      const result = await cmd.execute(parsed.args, session);

      if (result === CLEAR_SIGNAL) {
        setCommittedMessages([]);
        streamingRef.current = '';
        thinkingRef.current = '';
        toolCallsRef.current = new Map();
        setStreamingContent('');
        setStreamingThinking('');
        setActiveToolCalls(new Map());
        const clearMsg: ChatMessage = {
          id: uid(),
          role: 'system',
          content: 'Conversation cleared. Starting fresh.',
        };
        setCommittedMessages([clearMsg]);
        return true;
      }

      if (typeof result === 'string' && result.startsWith(COMPACT_SIGNAL_PREFIX)) {
        const summary = result.slice(COMPACT_SIGNAL_PREFIX.length);
        // Reset conversation and seed with summary
        session.conversationId = null;
        setCommittedMessages([]);
        streamingRef.current = '';
        thinkingRef.current = '';
        toolCallsRef.current = new Map();
        setStreamingContent('');
        setStreamingThinking('');
        setActiveToolCalls(new Map());
        const compactMsg: ChatMessage = {
          id: uid(),
          role: 'system',
          content: `Context compressed. Summary:\n${summary}`,
        };
        setCommittedMessages([compactMsg]);
        return true;
      }

      if (typeof result === 'string' && result) {
        const sysMsg: ChatMessage = { id: uid(), role: 'system', content: result };
        setCommittedMessages((prev) => [...prev, sysMsg]);
      }

      return true;
    },
    [session],
  );

  // ---------------------------------------------------------------------------
  // Handle initial prompt (non-interactive mode)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (options.initialPrompt) {
      void sendMessage(options.initialPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Keyboard input
  // ---------------------------------------------------------------------------
  useInput((inputChar, key) => {
    if (isSending) return;

    // Exit
    if (key.ctrl && (inputChar === 'c' || inputChar === 'd')) {
      exit();
      return;
    }

    // Submit
    if (key.return) {
      const text = inputValue.trim();
      setInputValue('');
      if (!text) return;

      // Check for slash command first
      void handleCommand(text).then((wasCommand) => {
        if (!wasCommand) {
          void sendMessage(text);
        }
      });
      return;
    }

    // Backspace
    if (key.backspace || key.delete) {
      setInputValue((v) => v.slice(0, -1));
      return;
    }

    // Regular character
    if (inputChar && !key.ctrl && !key.meta) {
      setInputValue((v) => v + inputChar);
    }
  });

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const shortId = session.conversationId?.slice(0, 8) ?? null;

  return (
    <Box flexDirection="column" width="100%">
      {/* Fixed header */}
      <Header
        model={session.model}
        conversationId={session.conversationId}
        apiUrl={session.apiUrl}
      />

      {/* Committed messages — rendered once, never updated */}
      <Static items={committedMessages}>
        {(msg) => (
          <Box key={msg.id} flexDirection="column" paddingX={1} marginBottom={0}>
            <MessageItem message={msg} />
          </Box>
        )}
      </Static>

      {/* Currently streaming output */}
      {(streamingContent || streamingThinking || activeToolCalls.size > 0) && (
        <Box flexDirection="column" paddingX={1}>
          {streamingThinking ? (
            <Text dimColor italic>
              {'Thinking: '}
              {streamingThinking.slice(-200)}
            </Text>
          ) : null}
          {Array.from(activeToolCalls.values()).map((tc) => (
            <Text key={tc.id} color={tc.status === 'error' ? 'red' : 'yellow'}>
              {tc.status === 'running' ? '⟳' : tc.status === 'error' ? '✗' : '✓'}
              {' '}
              {tc.name}
              {tc.output ? ` → ${tc.output.slice(0, 80)}` : ''}
            </Text>
          ))}
          {streamingContent ? (
            <Box>
              <Text bold color="cyan">{'Assistant: '}</Text>
              <Text wrap="wrap">{streamingContent}</Text>
            </Box>
          ) : null}
        </Box>
      )}

      {/* Input bar */}
      <InputArea
        value={inputValue}
        disabled={isSending}
        status={statusLine}
      />

      {/* Hint */}
      <Box paddingX={1}>
        <Text dimColor>
          {shortId ? `#${shortId}  ` : ''}
          {isSending ? 'Streaming…  ' : ''}
          Type /help for commands · Ctrl+C to exit
        </Text>
      </Box>
    </Box>
  );
}
