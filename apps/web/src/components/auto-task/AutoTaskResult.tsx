'use client';

import { useState } from 'react';

interface Props {
  result: string;
  durationMs?: number;
}

export function AutoTaskResult({ result }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  return (
    <div className="rounded-lg glass p-4" style={{ border: '1px solid #22c55e30', background: '#22c55e08' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#22c55e',
            }}
          />
          <span className="text-xs font-semibold" style={{ color: '#22c55e' }}>
            태스크 완료
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="text-xs px-2 py-1 rounded-md transition-colors"
          style={{
            color: copied ? '#22c55e' : 'var(--color-text-muted)',
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--glass-border)',
          }}
        >
          {copied ? '복사됨' : '복사'}
        </button>
      </div>
      <div
        className="text-sm whitespace-pre-wrap"
        style={{ color: 'var(--color-text-primary)', lineHeight: 1.6 }}
      >
        {result}
      </div>
    </div>
  );
}
