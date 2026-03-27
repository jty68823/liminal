'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import React, { useState } from 'react';

interface Props {
  content: string;
}

// react-markdown v9 passes `node` plus standard HTML attrs to code components
type CodeProps = React.HTMLAttributes<HTMLElement> & {
  node?: unknown;
  inline?: boolean;
};

function CodeBlock({ className, children, node: _node, inline: _inline, ...props }: CodeProps) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className ?? '');
  const language = match ? match[1] : undefined;
  const codeString = String(children ?? '');
  const isInline = !match && !codeString.includes('\n');

  const handleCopy = async () => {
    const code = codeString.replace(/\n$/, '');
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  if (isInline) {
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  }

  return (
    <div className="relative group" style={{ margin: '1em 0' }}>
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-4 py-1.5 rounded-t-lg"
        style={{
          background: 'rgba(0,0,0,0.3)',
          borderTop: '1px solid var(--color-code-border)',
          borderLeft: '1px solid var(--color-code-border)',
          borderRight: '1px solid var(--color-code-border)',
        }}
      >
        <span
          className="text-xs"
          style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}
        >
          {language ?? 'code'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded transition-all duration-100"
          style={{
            color: copied ? '#4caf7d' : 'var(--color-text-muted)',
          }}
          onMouseEnter={(e) => {
            if (!copied) {
              (e.currentTarget as HTMLElement).style.color = 'var(--color-text-secondary)';
            }
          }}
          onMouseLeave={(e) => {
            if (!copied) {
              (e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)';
            }
          }}
        >
          {copied ? (
            <>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Copied
            </>
          ) : (
            <>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>

      {/* Code block */}
      <pre
        style={{
          margin: 0,
          borderRadius: '0 0 var(--radius-md) var(--radius-md)',
          border: '1px solid var(--color-code-border)',
          borderTop: 'none',
          background: 'var(--color-code-bg)',
          overflow: 'hidden',
        }}
      >
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- react-markdown v9 + @types/react version mismatch workaround
const components: Record<string, React.ComponentType<any>> = {
  code: CodeBlock,
  a: ({ href, children, node: _node, ...props }: any) => (
    <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
  ),
  table: ({ children, node: _node, ...props }: any) => (
    <div style={{ overflowX: 'auto', margin: '1em 0' }}>
      <table {...props}>{children}</table>
    </div>
  ),
  blockquote: ({ children, node: _node, ...props }: any) => (
    <blockquote {...props}>{children}</blockquote>
  ),
};

// Memoized to avoid re-parsing markdown on every streaming token
function MarkdownContentInner({ content }: Props) {
  return (
    <div className="markdown-content">
      {React.createElement(ReactMarkdown as unknown as React.FC<{
        remarkPlugins: unknown[];
        rehypePlugins: unknown[];
        components: Record<string, React.ComponentType<any>>;
        children: string;
      }>, {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [rehypeHighlight],
        components,
        children: content,
      })}
    </div>
  );
}

export const MarkdownContent: React.FC<Props> = React.memo(MarkdownContentInner);
