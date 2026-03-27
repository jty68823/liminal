'use client';

import { useEffect, useRef, useState } from 'react';
import { useSettingsStore } from '@/store/settings.store';

export function ModelSelector() {
  const { models, selectedModel, setSelectedModel, loadModels, activeProvider } = useSettingsStore();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadModels();
  }, [loadModels, activeProvider]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const displayName = selectedModel
    ? models.find((m) => m.name === selectedModel)?.display_name ?? selectedModel
    : 'Auto';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
        style={{
          background: 'var(--color-bg-elevated)',
          color: 'var(--color-text-secondary)',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
        <span className="truncate max-w-[100px]">{displayName}</span>
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1 w-64 rounded-xl overflow-hidden z-50 glass-heavy"
          style={{
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--glass-border)',
          }}
        >
          <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--glass-border)' }}>
            <p className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
              Select Model ({activeProvider})
            </p>
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {/* Auto option */}
            <button
              onClick={() => { setSelectedModel(''); setIsOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs"
              style={{
                background: !selectedModel ? 'var(--color-bg-active)' : 'transparent',
                color: !selectedModel ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
              }}
            >
              <span className="font-medium">Auto</span>
              <span className="block text-xs opacity-50">Router picks the best model</span>
            </button>

            {models.map((m) => (
              <button
                key={m.name}
                onClick={() => { setSelectedModel(m.name); setIsOpen(false); }}
                className="w-full text-left px-3 py-2 text-xs sidebar-item"
                style={{
                  background: selectedModel === m.name ? 'var(--color-bg-active)' : 'transparent',
                  color: selectedModel === m.name ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
                }}
              >
                <span className="font-medium">{m.display_name}</span>
                <span className="block text-xs opacity-50">
                  {m.name}
                  {m.context_length ? ` · ${Math.round(m.context_length / 1024)}K ctx` : ''}
                </span>
              </button>
            ))}

            {models.length === 0 && (
              <p className="px-3 py-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                No models available. Is Ollama running?
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
