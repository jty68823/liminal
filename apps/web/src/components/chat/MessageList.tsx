'use client';

import { useEffect, useRef, useMemo } from 'react';
import { useChatStore } from '@/store/chat.store';
import { MessageBubble } from './MessageBubble';

export function MessageList() {
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const streamingContent = useChatStore((s) => s.streamingContent);
  const thinkingContent = useChatStore((s) => s.thinkingContent);
  const isThinking = useChatStore((s) => s.isThinking);
  const pendingToolCalls = useChatStore((s) => s.pendingToolCalls);

  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRafRef = useRef<number | null>(null);

  // Throttle scrollIntoView to one call per animation frame
  useEffect(() => {
    if (scrollRafRef.current) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const el = bottomRef.current;
      if (el) {
        el.scrollIntoView({ behavior: isStreaming ? 'auto' : 'smooth', block: 'end' });
      }
    });
  }, [messages.length, streamingContent, thinkingContent, isStreaming]);

  // Stable createdAt for the streaming message — only changes when streaming starts
  const streamingCreatedAt = useMemo(() => new Date().toISOString(), [isStreaming]);

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 px-4">
        {/* Skeleton loading */}
        <div className="max-w-2xl w-full mx-auto space-y-6">
          {/* Skeleton user message */}
          <div className="flex justify-end">
            <div className="w-64">
              <div className="skeleton h-10 rounded-2xl" />
            </div>
          </div>
          {/* Skeleton assistant message */}
          <div className="flex gap-3">
            <div className="skeleton w-7 h-7 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-3/4 rounded" />
              <div className="skeleton h-4 w-full rounded" />
              <div className="skeleton h-4 w-2/3 rounded" />
            </div>
          </div>
          {/* Skeleton user message 2 */}
          <div className="flex justify-end">
            <div className="w-48">
              <div className="skeleton h-8 rounded-2xl" />
            </div>
          </div>
          {/* Skeleton assistant message 2 */}
          <div className="flex gap-3">
            <div className="skeleton w-7 h-7 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-5/6 rounded" />
              <div className="skeleton h-4 w-1/2 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto"
      style={{ scrollbarWidth: 'thin' }}
    >
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-1">
        {messages.map((message, idx) => (
          <div
            key={message.id}
            className={idx > 0 ? 'message-enter-premium' : ''}
            style={idx > 0 ? { animationDelay: '0.05s' } : undefined}
          >
            <MessageBubble message={message} />
          </div>
        ))}

        {/* Streaming message */}
        {isStreaming && (
          <div className="message-enter-premium message-streaming">
            <MessageBubble
              message={{
                id: '__streaming__',
                conversationId: '',
                role: 'assistant',
                content: streamingContent,
                thinking: thinkingContent
                  ? [{ type: 'thinking', content: thinkingContent }]
                  : undefined,
                toolCalls: pendingToolCalls.length > 0 ? pendingToolCalls : undefined,
                createdAt: streamingCreatedAt,
              }}
              isStreaming
            />
          </div>
        )}

        <div ref={bottomRef} className="h-4" />
      </div>
    </div>
  );
}
