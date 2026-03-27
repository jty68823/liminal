'use client';

import React, { useState } from 'react';
import { type Message } from '@/store/chat.store';
import { MarkdownContent } from '@/lib/markdown';
import { ToolCallDisplay } from './ToolCallDisplay';
import { SubAgentDisplay } from './SubAgentDisplay';
import { useArtifactStore } from '@/store/artifact.store';
import { Logo } from '@/components/ui/Logo';

interface Props {
  message: Message;
  isStreaming?: boolean;
}

function ThinkingBlock({ content }: { content: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className={`thinking-block mb-3 rounded-xl overflow-hidden glass ${isOpen ? 'thinking-active' : ''}`}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="tool-call-header w-full flex items-center gap-2 px-3.5 py-2.5 text-left"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.25s var(--ease-spring)',
            flexShrink: 0,
          }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0, opacity: 0.7 }}
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span className="text-xs font-medium italic">Thinking</span>
        <span className="text-xs ml-auto opacity-50">{isOpen ? 'hide' : 'show'}</span>
      </button>
      {isOpen && (
        <div
          className="px-4 py-3 text-xs italic leading-relaxed"
          style={{
            borderTop: '1px solid var(--glass-border)',
            color: 'var(--color-text-muted)',
            fontFamily: 'var(--font-mono)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
}

const ArtifactButton = React.memo(function ArtifactButton({ artifactId, title, type }: { artifactId: string; title: string; type: string }) {
  const artifact = useArtifactStore((s) => s.history.find((a) => a.id === artifactId));
  const setArtifact = useArtifactStore((s) => s.setArtifact);
  const isActive = useArtifactStore((s) => s.activeArtifact?.id === artifactId);

  const handleClick = () => {
    if (artifact) {
      setArtifact(artifact);
    }
  };

  const typeColors: Record<string, string> = {
    code: '#61afef',
    html: '#e06c75',
    mermaid: '#98c379',
    react: '#56b6c2',
    text: '#abb2bf',
  };

  return (
    <button
      onClick={handleClick}
      className="glow-hover btn-ripple flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-left mt-3"
      style={{
        background: isActive ? 'var(--color-bg-active)' : 'var(--color-bg-elevated)',
        border: `1px solid ${isActive ? 'var(--color-border-default)' : 'var(--color-border-subtle)'}`,
        maxWidth: '320px',
      }}
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: 'var(--color-bg-surface)' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={typeColors[type] ?? '#abb2bf'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
          {title}
        </p>
        <p className="text-xs capitalize" style={{ color: typeColors[type] ?? 'var(--color-text-muted)' }}>
          {type}
        </p>
      </div>
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="ml-auto flex-shrink-0"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
});

export const MessageBubble = React.memo(function MessageBubble({ message, isStreaming }: Props) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  if (isUser) {
    return (
      <div className="flex justify-end py-1">
        <div
          className="max-w-lg px-4 py-3 rounded-2xl text-sm leading-relaxed"
          style={{
            background: 'var(--color-user-bg)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid var(--color-user-border)',
            borderRight: '2px solid rgba(99, 102, 241, 0.3)',
            color: 'var(--color-text-primary)',
            wordBreak: 'break-word',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {message.images && message.images.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {message.images.map((b64, i) => (
                <img
                  key={i}
                  src={`data:image/jpeg;base64,${b64}`}
                  alt={`Image ${i + 1}`}
                  className="max-w-xs max-h-48 rounded-lg object-contain"
                  style={{ border: '1px solid var(--color-border-subtle)' }}
                />
              ))}
            </div>
          )}
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  if (isAssistant) {
    return (
      <div className="flex gap-3 py-2">
        {/* Avatar */}
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${isStreaming ? 'animate-pulse-glow' : ''}`}
          style={{
            background: 'linear-gradient(135deg, var(--color-accent-primary), #b87a50)',
            boxShadow: isStreaming ? '0 0 15px rgba(212,149,107,0.2)' : 'var(--shadow-sm)',
          }}
        >
          <Logo size={13} color="white" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Thinking blocks */}
          {message.thinking?.map((block, idx) => (
            <ThinkingBlock key={idx} content={block.content} />
          ))}

          {/* Tool calls */}
          {message.toolCalls?.map((tc) => (
            <ToolCallDisplay key={tc.id} toolCall={tc} />
          ))}

          {/* Sub-agent results */}
          {message.subAgentResults && message.subAgentResults.length > 0 && (
            <SubAgentDisplay results={message.subAgentResults} />
          )}

          {/* Content */}
          {message.content && (
            <div className="text-sm leading-relaxed">
              <div className={isStreaming && message.content ? 'streaming-cursor' : ''}>
                <MarkdownContent content={message.content} />
              </div>
            </div>
          )}

          {/* Streaming placeholder */}
          {isStreaming && !message.content && !message.thinking?.length && !message.toolCalls?.length && (
            <div className="flex items-center gap-2.5 py-3 px-1">
              <div className="flex items-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-2 h-2 rounded-full animate-bounce"
                    style={{
                      background: 'var(--color-accent-primary)',
                      animationDelay: `${i * 0.16}s`,
                      boxShadow: '0 0 8px rgba(212,149,107,0.3)',
                    }}
                  />
                ))}
              </div>
              <span className="text-xs italic" style={{ color: 'var(--color-text-muted)' }}>
                Thinking...
              </span>
            </div>
          )}

          {/* Artifact buttons */}
          {message.artifacts?.map((artifact) => (
            <ArtifactButton
              key={artifact.id}
              artifactId={artifact.id}
              title={artifact.title}
              type={artifact.type}
            />
          ))}
        </div>
      </div>
    );
  }

  return null;
}, (prevProps, nextProps) => {
  // Custom comparison: skip re-render if key message fields and streaming state are unchanged
  const prevMsg = prevProps.message;
  const nextMsg = nextProps.message;
  return (
    prevMsg.id === nextMsg.id &&
    prevMsg.content === nextMsg.content &&
    prevMsg.role === nextMsg.role &&
    prevProps.isStreaming === nextProps.isStreaming &&
    prevMsg.thinking === nextMsg.thinking &&
    prevMsg.toolCalls === nextMsg.toolCalls &&
    prevMsg.artifacts === nextMsg.artifacts &&
    prevMsg.subAgentResults === nextMsg.subAgentResults
  );
});
