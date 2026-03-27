'use client';

import { useEffect, useState } from 'react';

export function ConnectionStatus() {
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');

  useEffect(() => {
    const check = async () => {
      try {
        const resp = await fetch('/api/v1/settings/providers/health');
        if (resp.ok) {
          const data = await resp.json();
          setStatus(data.healthy ? 'connected' : 'disconnected');
        } else {
          setStatus('disconnected');
        }
      } catch {
        setStatus('disconnected');
      }
    };

    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, []);

  if (status === 'connected') return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-40 flex items-center gap-2 px-3 py-2 rounded-xl glass text-xs"
      style={{
        background: status === 'disconnected' ? 'rgba(239,68,68,0.1)' : 'var(--color-bg-elevated)',
        border: `1px solid ${status === 'disconnected' ? 'rgba(239,68,68,0.3)' : 'var(--color-border-default)'}`,
        color: status === 'disconnected' ? '#ef4444' : 'var(--color-text-muted)',
      }}
    >
      <div
        className="w-2 h-2 rounded-full"
        style={{
          background: status === 'disconnected' ? '#ef4444' : 'var(--color-text-muted)',
          animation: status === 'checking' ? 'pulse 1.5s infinite' : undefined,
        }}
      />
      {status === 'disconnected' && 'Provider disconnected'}
      {status === 'checking' && 'Checking connection...'}
    </div>
  );
}
