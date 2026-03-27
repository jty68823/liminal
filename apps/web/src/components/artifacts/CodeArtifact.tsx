'use client';

import { useState, useEffect, useRef } from 'react';

interface Props {
  content: string;
  language?: string;
}

async function highlightCode(code: string, language?: string): Promise<string> {
  try {
    const hljs = (await import('highlight.js')).default;
    if (language) {
      try {
        const result = hljs.highlight(code, { language });
        return result.value;
      } catch {
        // Language not found, fall through to auto
      }
    }
    const result = hljs.highlightAuto(code);
    return result.value;
  } catch {
    return code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}

function getLineNumbers(code: string): number[] {
  return Array.from({ length: code.split('\n').length }, (_, i) => i + 1);
}

export function CodeArtifact({ content, language }: Props) {
  const [copied, setCopied] = useState(false);
  const [highlighted, setHighlighted] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsLoading(true);
    highlightCode(content, language).then((html) => {
      setHighlighted(html);
      setIsLoading(false);
    });
  }, [content, language]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.createElement('textarea');
      el.value = content;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const lineNumbers = getLineNumbers(content);

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-code-bg)' }}>
      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-4 py-2 flex-shrink-0"
        style={{
          background: 'rgba(0,0,0,0.25)',
          borderBottom: '1px solid var(--color-code-border)',
        }}
      >
        <div className="flex items-center gap-2">
          {/* Terminal-style dots with glow */}
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full terminal-dot-red" style={{ background: '#ef4444' }} />
            <div className="w-3 h-3 rounded-full terminal-dot-yellow" style={{ background: '#d4956b' }} />
            <div className="w-3 h-3 rounded-full terminal-dot-green" style={{ background: '#22c55e' }} />
          </div>
          {language && (
            <span
              className="text-xs ml-2"
              style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}
            >
              {language}
            </span>
          )}
        </div>

        <button
          onClick={handleCopy}
          className={`code-copy-btn btn-ripple flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs ${copied ? 'scale-enter' : ''}`}
          style={{
            background: copied ? 'rgba(34,197,94,0.15)' : 'var(--color-bg-elevated)',
            color: copied ? '#22c55e' : 'var(--color-text-secondary)',
            border: `1px solid ${copied ? 'rgba(34,197,94,0.2)' : 'var(--color-border-subtle)'}`,
          }}
        >
          {copied ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>

      {/* Code area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto"
        style={{ fontSize: '13px', lineHeight: '1.6' }}
      >
        {isLoading ? (
          <div className="p-4 space-y-2.5">
            <div className="skeleton h-4 w-3/4 rounded" />
            <div className="skeleton h-4 w-1/2 rounded" />
            <div className="skeleton h-4 w-5/6 rounded" />
            <div className="skeleton h-4 w-2/3 rounded" />
            <div className="skeleton h-4 w-4/5 rounded" />
            <div className="skeleton h-4 w-3/5 rounded" />
          </div>
        ) : (
          <table className="w-full border-collapse" style={{ fontFamily: 'var(--font-mono)' }}>
            <tbody>
              {content.split('\n').map((_, idx) => (
                <tr key={idx} className="group" style={{ lineHeight: '1.6' }}>
                  <td
                    className="select-none text-right pr-4 pl-4 text-xs sticky left-0"
                    style={{
                      color: 'var(--color-text-muted)',
                      background: 'var(--color-code-bg)',
                      borderRight: '1px solid var(--color-code-border)',
                      minWidth: '48px',
                      userSelect: 'none',
                      transition: 'background 0.1s ease',
                    }}
                  >
                    {lineNumbers[idx]}
                  </td>
                  <td
                    className="pl-4 pr-6"
                    style={{ transition: 'background 0.1s ease' }}
                  >
                    <span
                      // eslint-disable-next-line react/no-danger
                      dangerouslySetInnerHTML={{
                        __html: highlighted.split('\n')[idx] ?? '',
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
