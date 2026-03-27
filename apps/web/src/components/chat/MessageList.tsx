'use client';

import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { useChatStore } from '@/store/chat.store';
import { MessageBubble } from './MessageBubble';

/** Max number of messages rendered at once (older ones are dropped from DOM) */
const MAX_RENDERED_MESSAGES = 100;
const LOAD_MORE_STEP = 50;

/** Memoized wrapper for individual message items to prevent unnecessary re-renders */
const MessageItem = React.memo(function MessageItem({
  message,
  showAnimation,
}: {
  message: ReturnType<typeof useChatStore.getState>['messages'][number];
  showAnimation: boolean;
}) {
  return (
    <div
      className={showAnimation ? 'message-enter-premium' : ''}
      style={showAnimation ? { animationDelay: '0.05s' } : undefined}
    >
      <MessageBubble message={message} />
    </div>
  );
}, (prev, next) => {
  return prev.message === next.message && prev.showAnimation === next.showAnimation;
});

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

  // Track whether user is at the bottom of the scroll area
  const [isAtBottom, setIsAtBottom] = useState(true);

  // IntersectionObserver to detect when the bottom sentinel is visible
  useEffect(() => {
    const sentinel = bottomRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsAtBottom(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  // Throttle scrollIntoView to one call per animation frame — only auto-scroll if user is at bottom
  useEffect(() => {
    if (!isAtBottom) return;
    if (scrollRafRef.current) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const el = bottomRef.current;
      if (el) {
        el.scrollIntoView({ behavior: isStreaming ? 'auto' : 'smooth', block: 'end' });
      }
    });
  }, [messages.length, streamingContent, thinkingContent, isStreaming, isAtBottom]);

  const scrollToBottom = useCallback(() => {
    const el = bottomRef.current;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, []);

  // Stable createdAt for the streaming message — only changes when streaming starts
  const streamingCreatedAt = useMemo(() => new Date().toISOString(), [isStreaming]);

  const [renderLimit, setRenderLimit] = useState(MAX_RENDERED_MESSAGES);

  const loadOlderMessages = useCallback(() => {
    setRenderLimit((prev) => Math.min(prev + LOAD_MORE_STEP, messages.length));
  }, [messages.length]);

  // Limit rendered messages to avoid DOM overload in long conversations
  const renderedMessages = useMemo(() => {
    if (messages.length <= renderLimit) return messages;
    return messages.slice(-renderLimit);
  }, [messages, renderLimit]);

  const hiddenCount = messages.length - renderedMessages.length;

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
      className="h-full overflow-y-auto relative"
      style={{ scrollbarWidth: 'thin' }}
    >
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-1">
        {/* Truncation notice when messages are clipped */}
        {hiddenCount > 0 && (
          <div className="text-center py-2">
            <button
              onClick={loadOlderMessages}
              className="text-xs px-3 py-1.5 rounded-full transition-colors duration-150 cursor-pointer hover:brightness-125"
              style={{
                background: 'var(--color-bg-elevated)',
                color: 'var(--color-text-muted)',
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              Load {Math.min(LOAD_MORE_STEP, hiddenCount)} older messages ({hiddenCount} hidden)
            </button>
          </div>
        )}

        {renderedMessages.map((message, idx) => (
          <MessageItem
            key={message.id}
            message={message}
            showAnimation={idx > 0}
          />
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

      {/* Scroll-to-bottom floating button */}
      {!isAtBottom && (
        <button
          onClick={scrollToBottom}
          className="fixed z-50 flex items-center justify-center w-9 h-9 rounded-full shadow-lg transition-all duration-200 hover:scale-110"
          style={{
            bottom: '120px',
            right: '50%',
            transform: 'translateX(50%)',
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-default)',
            color: 'var(--color-text-secondary)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
          aria-label="Scroll to bottom"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}
    </div>
  );
}
