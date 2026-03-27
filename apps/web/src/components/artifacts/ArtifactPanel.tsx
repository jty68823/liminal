'use client';

import { useState, useEffect, useRef } from 'react';
import { useArtifactStore, type Artifact } from '@/store/artifact.store';
import { CodeArtifact } from './CodeArtifact';
import { ReactArtifact } from './ReactArtifact';
import { ArtifactExport } from './ArtifactExport';
import { ArtifactVersionHistory } from './ArtifactVersionHistory';
import { MarkdownContent } from '@/lib/markdown';

function HtmlArtifact({ content }: { content: string }) {
  return (
    <iframe
      srcDoc={content}
      sandbox="allow-scripts allow-same-origin"
      className="w-full h-full border-0"
      title="HTML Preview"
      style={{ background: 'white' }}
    />
  );
}

function SvgArtifact({ content }: { content: string }) {
  const srcDoc = `<!DOCTYPE html>
<html><head><style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#1c1c1f;}</style></head>
<body>${content}</body></html>`;
  return (
    <iframe
      srcDoc={srcDoc}
      sandbox="allow-same-origin"
      className="w-full h-full border-0"
      title="SVG Preview"
    />
  );
}

function MarkdownArtifact({ content }: { content: string }) {
  return (
    <div className="h-full overflow-y-auto p-6">
      <MarkdownContent content={content} />
    </div>
  );
}

function MermaidArtifact({ content }: { content: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      if (!containerRef.current) return;
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          themeVariables: {
            background: '#1c1c1f',
            primaryColor: '#d4956b',
            primaryTextColor: '#f0f0ee',
            primaryBorderColor: '#333333',
            lineColor: '#555555',
            secondaryColor: '#1c1c1f',
            tertiaryColor: '#242428',
          },
        });
        const id = `mermaid-${Date.now()}`;
        const { svg } = await mermaid.render(id, content);
        if (!cancelled && containerRef.current) {
          // mermaid.render() produces sanitized SVG output
          containerRef.current.innerHTML = svg;
          setRendered(true);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to render diagram');
        }
      }
    }

    render();
    return () => { cancelled = true; };
  }, [content]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
          style={{ background: 'rgba(239,68,68,0.1)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <p className="text-sm font-medium mb-1" style={{ color: '#ef4444' }}>Diagram error</p>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{error}</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full p-6 overflow-auto">
      <div
        ref={containerRef}
        className="mermaid-container"
        style={{
          opacity: rendered ? 1 : 0,
          transition: 'opacity 0.3s var(--ease-smooth)',
          maxWidth: '100%',
        }}
      />
      {!rendered && !error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
            style={{
              borderColor: 'var(--color-border-default)',
              borderTopColor: 'var(--color-accent-primary)',
              boxShadow: '0 0 10px rgba(212,149,107,0.15)',
            }}
          />
        </div>
      )}
    </div>
  );
}

function TextArtifact({ content }: { content: string }) {
  return (
    <div className="h-full overflow-y-auto p-6">
      <pre
        className="text-sm leading-relaxed whitespace-pre-wrap"
        style={{
          color: 'var(--color-text-primary)',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {content}
      </pre>
    </div>
  );
}

const TYPE_LABELS: Record<Artifact['type'], string> = {
  code: 'Code',
  html: 'HTML',
  mermaid: 'Diagram',
  react: 'React',
  svg: 'SVG',
  markdown: 'Markdown',
  text: 'Text',
};

const TYPE_BADGE_COLORS: Record<Artifact['type'], { bg: string; text: string; glow: string }> = {
  code: { bg: 'rgba(97,175,239,0.12)', text: '#61afef', glow: 'rgba(97,175,239,0.2)' },
  html: { bg: 'rgba(224,108,117,0.12)', text: '#e06c75', glow: 'rgba(224,108,117,0.2)' },
  mermaid: { bg: 'rgba(152,195,121,0.12)', text: '#98c379', glow: 'rgba(152,195,121,0.2)' },
  react: { bg: 'rgba(86,182,194,0.12)', text: '#56b6c2', glow: 'rgba(86,182,194,0.2)' },
  svg: { bg: 'rgba(229,192,123,0.12)', text: '#e5c07b', glow: 'rgba(229,192,123,0.2)' },
  markdown: { bg: 'rgba(198,120,221,0.12)', text: '#c678dd', glow: 'rgba(198,120,221,0.2)' },
  text: { bg: 'rgba(171,178,191,0.12)', text: '#abb2bf', glow: 'rgba(171,178,191,0.2)' },
};

export function ArtifactPanel() {
  const { activeArtifact, close, updateArtifact } = useArtifactStore();
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  if (!activeArtifact) return null;

  const badgeColors = TYPE_BADGE_COLORS[activeArtifact.type];
  const typeLabel = TYPE_LABELS[activeArtifact.type];
  const version = activeArtifact.version ?? 1;

  const handleRestore = (content: string) => {
    updateArtifact(activeArtifact.id, content);
  };

  const renderContent = () => {
    switch (activeArtifact.type) {
      case 'html':
        return <HtmlArtifact content={activeArtifact.content} />;
      case 'mermaid':
        return <MermaidArtifact content={activeArtifact.content} />;
      case 'svg':
        return <SvgArtifact content={activeArtifact.content} />;
      case 'markdown':
        return <MarkdownArtifact content={activeArtifact.content} />;
      case 'text':
        return <TextArtifact content={activeArtifact.content} />;
      case 'react':
        return <ReactArtifact content={activeArtifact.content} />;
      case 'code':
      default:
        return (
          <CodeArtifact
            content={activeArtifact.content}
            language={activeArtifact.language}
          />
        );
    }
  };

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: 'var(--color-bg-secondary)' }}
    >
      {/* Header */}
      <div
        className="artifact-header-divider relative flex items-center gap-3 px-4 py-3 flex-shrink-0 glass"
        style={{
          borderBottom: 'none',
        }}
      >
        {/* Type badge */}
        <span
          className="artifact-badge text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
          style={{
            background: badgeColors.bg,
            color: badgeColors.text,
            boxShadow: `0 0 8px ${badgeColors.glow}`,
          }}
        >
          {typeLabel}
        </span>

        {/* Title */}
        <h2
          className="text-sm font-medium flex-1 truncate"
          style={{ color: 'var(--color-text-primary)' }}
          title={activeArtifact.title}
        >
          {activeArtifact.title}
        </h2>

        {/* Language badge for code */}
        {activeArtifact.language && (
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{
              background: 'var(--color-bg-elevated)',
              color: 'var(--color-text-muted)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {activeArtifact.language}
          </span>
        )}

        {/* Version badge */}
        <button
          onClick={() => setShowVersionHistory(!showVersionHistory)}
          className="text-xs px-1.5 py-0.5 rounded transition-colors hover:bg-white/10"
          style={{
            background: 'var(--color-bg-elevated)',
            color: 'var(--color-text-muted)',
            fontFamily: 'var(--font-mono)',
          }}
          title="Toggle version history"
        >
          v{version}
        </button>

        {/* Export buttons */}
        <ArtifactExport
          content={activeArtifact.content}
          filename={activeArtifact.title}
          language={activeArtifact.language}
        />

        {/* Close button */}
        <button
          onClick={close}
          className="close-btn flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0"
          style={{ color: 'var(--color-text-muted)' }}
          aria-label="Close artifact panel"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Version History dropdown */}
      {showVersionHistory && (
        <div className="px-4 pb-3 flex-shrink-0">
          <ArtifactVersionHistory
            artifactId={activeArtifact.id}
            currentVersion={version}
            onRestore={handleRestore}
          />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        {renderContent()}
      </div>
    </div>
  );
}
