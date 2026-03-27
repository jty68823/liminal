'use client';

import React, { useState } from 'react';
import { type ToolCall } from '@/store/chat.store';

interface Props {
  toolCall: ToolCall;
}

function formatJSON(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

const TOOL_ICONS: Record<string, React.ReactNode> = {
  bash: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  ),
  computer: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  ),
  web_search: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
};

function getToolIcon(name: string): React.ReactNode {
  const lname = name.toLowerCase();
  for (const [key, icon] of Object.entries(TOOL_ICONS)) {
    if (lname.includes(key)) return icon;
  }
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

export const ToolCallDisplay = React.memo(function ToolCallDisplay({ toolCall }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const isDone = !toolCall.isPending;
  const isError = toolCall.isError;

  return (
    <div
      className="mb-2 rounded-xl overflow-hidden glass"
      style={{
        borderColor: isError ? 'rgba(239,68,68,0.2)' : undefined,
      }}
    >
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="tool-call-header w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left"
      >
        {/* Status indicator */}
        <div className="flex-shrink-0">
          {toolCall.isPending ? (
            <div
              className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
              style={{
                borderColor: 'var(--color-border-default)',
                borderTopColor: '#61afef',
                boxShadow: '0 0 8px rgba(97,175,239,0.2)',
              }}
            />
          ) : isError ? (
            <div
              className="w-4 h-4 rounded-full flex items-center justify-center scale-enter"
              style={{ background: 'rgba(239,68,68,0.15)' }}
            >
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
          ) : (
            <div
              className="w-4 h-4 rounded-full flex items-center justify-center scale-enter"
              style={{ background: 'rgba(34,197,94,0.15)' }}
            >
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          )}
        </div>

        {/* Tool icon */}
        <span style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>
          {getToolIcon(toolCall.name)}
        </span>

        {/* Tool name */}
        <span
          className="text-xs font-medium font-mono"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {toolCall.name}
        </span>

        {/* Status text */}
        {toolCall.isPending && (
          <span
            className="text-xs italic ml-1"
            style={{ color: 'var(--color-text-muted)' }}
          >
            running...
          </span>
        )}

        {/* Expand arrow */}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="ml-auto flex-shrink-0"
          style={{
            color: 'var(--color-text-muted)',
            transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.25s var(--ease-spring)',
          }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {/* Expanded content */}
      {isOpen && (
        <div style={{ borderTop: '1px solid var(--glass-border)' }}>
          {/* Input */}
          {Object.keys(toolCall.input ?? {}).length > 0 && (
            <div className="px-3.5 py-3">
              <p
                className="text-xs font-medium mb-1.5"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Input
              </p>
              <pre
                className="text-xs overflow-x-auto rounded-lg p-2.5"
                style={{
                  background: 'var(--color-code-bg)',
                  color: '#abb2bf',
                  fontFamily: 'var(--font-mono)',
                  lineHeight: '1.5',
                  border: '1px solid var(--color-code-border)',
                }}
              >
                {formatJSON(toolCall.input)}
              </pre>
            </div>
          )}

          {/* Output */}
          {isDone && toolCall.result !== undefined && (
            <div className="px-3.5 py-3" style={{ borderTop: '1px solid var(--glass-border)' }}>
              <p
                className="text-xs font-medium mb-1.5"
                style={{ color: isError ? '#ef4444' : 'var(--color-text-muted)' }}
              >
                {isError ? 'Error' : 'Output'}
              </p>
              <pre
                className="text-xs overflow-x-auto rounded-lg p-2.5"
                style={{
                  background: 'var(--color-code-bg)',
                  color: isError ? '#ef4444' : '#abb2bf',
                  fontFamily: 'var(--font-mono)',
                  lineHeight: '1.5',
                  border: `1px solid ${isError ? 'rgba(239,68,68,0.2)' : 'var(--color-code-border)'}`,
                  maxHeight: '200px',
                }}
              >
                {formatJSON(toolCall.result)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
