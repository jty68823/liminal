'use client';

import { useState } from 'react';
import { type SubAgentResult } from '@/store/chat.store';

interface Props {
  results: SubAgentResult[];
}

export function SubAgentDisplay({ results }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggle = (idx: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  if (results.length === 0) return null;

  return (
    <div className="space-y-2 my-3">
      <div
        className="flex items-center gap-2 text-xs font-medium"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
        Sub-agents ({results.length})
      </div>
      {results.map((r, idx) => (
        <div
          key={idx}
          className="glass rounded-xl overflow-hidden"
          style={{
            border: `1px solid ${r.status === 'error' ? 'rgba(239,68,68,0.2)' : 'var(--glass-border)'}`,
          }}
        >
          <button
            onClick={() => toggle(idx)}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left"
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{
                background: r.status === 'success' ? '#22c55e' : '#ef4444',
                boxShadow: `0 0 6px ${r.status === 'success' ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
              }}
            />
            <span
              className="text-xs font-medium flex-1"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {r.role}
            </span>
            <span
              className="text-xs"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {r.durationMs}ms
            </span>
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              style={{
                color: 'var(--color-text-muted)',
                transform: expanded.has(idx) ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s var(--ease-spring)',
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {expanded.has(idx) && (
            <div
              className="px-3.5 py-3 text-xs leading-relaxed"
              style={{
                borderTop: '1px solid var(--glass-border)',
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-mono)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {r.output}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
