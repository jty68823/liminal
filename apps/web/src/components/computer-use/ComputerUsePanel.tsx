'use client';

import { useState, useEffect } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function ComputerUsePanel({ isOpen, onClose }: Props) {
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [actionStatus, setActionStatus] = useState<string>('');
  // click inputs
  const [clickX, setClickX] = useState('');
  const [clickY, setClickY] = useState('');
  const [clickButton, setClickButton] = useState<'left' | 'right' | 'middle'>('left');
  // type input
  const [typeText, setTypeText] = useState('');
  // key input
  const [keyInput, setKeyInput] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const captureScreenshot = async () => {
    setIsCapturing(true);
    try {
      const res = await fetch('/api/v1/tools/computer/screenshot');
      const data = await res.json() as { output?: string; error?: string; is_error?: boolean };
      if (data.is_error || data.error) {
        setActionStatus(data.error ?? data.output ?? 'Error');
      } else {
        setScreenshot(data.output ?? null);
      }
    } catch {
      setActionStatus('Failed to capture screenshot');
    } finally {
      setIsCapturing(false);
    }
  };

  const sendAction = async (action: Record<string, unknown>) => {
    try {
      const res = await fetch('/api/v1/tools/computer/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
      });
      const data = await res.json() as { output?: string; error?: string; is_error?: boolean };
      setActionStatus(data.is_error ? (data.output ?? 'Error') : (data.output ?? 'Done'));
    } catch {
      setActionStatus('Action failed');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '420px',
        zIndex: 50,
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderLeft: '1px solid var(--glass-border)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-primary)" strokeWidth="2">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>Computer Use</span>
        </div>
        <button
          onClick={onClose}
          style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          aria-label="Close Computer Use panel"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Screenshot */}
        <div className="glass" style={{ padding: 14, borderRadius: 12, border: '1px solid var(--glass-border)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Screenshot
          </div>
          <button
            onClick={captureScreenshot}
            disabled={isCapturing}
            className="glow-hover"
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 8,
              background: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border-subtle)',
              color: 'var(--color-text-primary)',
              fontSize: 13,
              cursor: isCapturing ? 'wait' : 'pointer',
              marginBottom: screenshot ? 10 : 0,
            }}
          >
            {isCapturing ? 'Capturing...' : 'Capture Screenshot'}
          </button>
          {screenshot && (
            <img
              src={screenshot}
              alt="Screenshot"
              style={{ width: '100%', borderRadius: 8, border: '1px solid var(--glass-border)' }}
            />
          )}
        </div>

        {/* Click */}
        <div className="glass" style={{ padding: 14, borderRadius: 12, border: '1px solid var(--glass-border)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Click
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              type="number"
              placeholder="X"
              value={clickX}
              onChange={e => setClickX(e.target.value)}
              style={{ flex: 1, padding: '6px 10px', borderRadius: 6, background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', color: 'var(--color-text-primary)', fontSize: 13 }}
            />
            <input
              type="number"
              placeholder="Y"
              value={clickY}
              onChange={e => setClickY(e.target.value)}
              style={{ flex: 1, padding: '6px 10px', borderRadius: 6, background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', color: 'var(--color-text-primary)', fontSize: 13 }}
            />
            <select
              value={clickButton}
              onChange={e => setClickButton(e.target.value as 'left' | 'right' | 'middle')}
              style={{ padding: '6px 8px', borderRadius: 6, background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', color: 'var(--color-text-primary)', fontSize: 13 }}
            >
              <option value="left">Left</option>
              <option value="right">Right</option>
              <option value="middle">Middle</option>
            </select>
          </div>
          <button
            onClick={() => sendAction({ type: 'click', x: Number(clickX), y: Number(clickY), button: clickButton })}
            className="glow-hover"
            style={{ width: '100%', padding: '7px 12px', borderRadius: 8, background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-subtle)', color: 'var(--color-text-primary)', fontSize: 13, cursor: 'pointer' }}
          >
            Click
          </button>
        </div>

        {/* Type */}
        <div className="glass" style={{ padding: 14, borderRadius: 12, border: '1px solid var(--glass-border)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Type
          </div>
          <input
            type="text"
            placeholder="Text to type..."
            value={typeText}
            onChange={e => setTypeText(e.target.value)}
            style={{ width: '100%', padding: '6px 10px', borderRadius: 6, background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', color: 'var(--color-text-primary)', fontSize: 13, marginBottom: 8, boxSizing: 'border-box' }}
          />
          <button
            onClick={() => sendAction({ type: 'type', text: typeText })}
            className="glow-hover"
            style={{ width: '100%', padding: '7px 12px', borderRadius: 8, background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-subtle)', color: 'var(--color-text-primary)', fontSize: 13, cursor: 'pointer' }}
          >
            Type
          </button>
        </div>

        {/* Key Press */}
        <div className="glass" style={{ padding: 14, borderRadius: 12, border: '1px solid var(--glass-border)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Key Press
          </div>
          <input
            type="text"
            placeholder="e.g. enter, ctrl+c, alt+tab"
            value={keyInput}
            onChange={e => setKeyInput(e.target.value)}
            style={{ width: '100%', padding: '6px 10px', borderRadius: 6, background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', color: 'var(--color-text-primary)', fontSize: 13, marginBottom: 8, boxSizing: 'border-box' }}
          />
          <button
            onClick={() => sendAction({ type: 'key', key: keyInput })}
            className="glow-hover"
            style={{ width: '100%', padding: '7px 12px', borderRadius: 8, background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-subtle)', color: 'var(--color-text-primary)', fontSize: 13, cursor: 'pointer' }}
          >
            Press Key
          </button>
        </div>

        {/* Status */}
        {actionStatus && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--glass-border)',
              fontSize: 12,
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-mono)',
              wordBreak: 'break-word',
            }}
          >
            {actionStatus}
          </div>
        )}
      </div>
    </div>
  );
}
