'use client';

import { useRef, useState, useCallback } from 'react';

interface Props {
  onSend: (content: string, images?: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function InputBar({ onSend, disabled = false, placeholder }: Props) {
  const [value, setValue] = useState('');
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    adjustHeight();
  };

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed, pendingImages.length > 0 ? pendingImages : undefined);
    setValue('');
    setPendingImages([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        const base64 = result.split(',')[1];
        if (base64) setPendingImages(prev => [...prev, base64]);
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (idx: number) => {
    setPendingImages(prev => prev.filter((_, i) => i !== idx));
  };

  const canSend = value.trim().length > 0 && !disabled;

  return (
    <div
      className="input-bar-glass rounded-2xl"
      style={{
        background: 'rgba(22, 22, 24, 0.6)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid var(--color-border-default)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.3), 0 0 0 0.5px rgba(255,255,255,0.04) inset',
      }}
    >
      {/* Image previews */}
      {pendingImages.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pt-3">
          {pendingImages.map((b64, idx) => (
            <div key={idx} className="relative group">
              <img
                src={`data:image/jpeg;base64,${b64}`}
                alt={`Image ${idx + 1}`}
                className="w-16 h-16 object-cover rounded-lg transition-premium"
                style={{
                  border: '1px solid var(--color-border-default)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              />
              <button
                onClick={() => removeImage(idx)}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-premium"
                style={{
                  background: 'var(--color-bg-elevated)',
                  color: 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border-default)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2 px-4 py-3">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Attach button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0"
          style={{ color: 'var(--color-text-muted)' }}
          title="Attach image"
          aria-label="Attach image"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
        </button>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? 'Message Liminal...'}
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm leading-relaxed focus:outline-none disabled:opacity-50"
          style={{
            color: 'var(--color-text-primary)',
            minHeight: '24px',
            maxHeight: '200px',
            caretColor: 'var(--color-accent-primary)',
          }}
        />

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {!disabled && (
            <span className="text-xs hidden sm:block" style={{ color: 'var(--color-text-muted)' }}>⏎ send</span>
          )}
          {disabled && (
            <div
              className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin flex-shrink-0"
              style={{
                borderColor: 'rgba(212,149,107,0.2)',
                borderTopColor: 'var(--color-accent-primary)',
                boxShadow: '0 0 12px rgba(212,149,107,0.15)',
              }}
            />
          )}
          <button
            onClick={handleSend}
            disabled={!canSend}
            className={`flex items-center justify-center w-8 h-8 rounded-xl flex-shrink-0 btn-ripple ${canSend ? 'send-btn-active' : ''}`}
            style={{
              background: canSend ? undefined : 'var(--color-bg-elevated)',
              color: canSend ? 'white' : 'var(--color-text-muted)',
              cursor: canSend ? 'pointer' : 'default',
            }}
            aria-label="Send message"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
