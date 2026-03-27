'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  code: string;
}

export function MermaidArtifact({ code }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Dynamically import mermaid to keep bundle size small
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          themeVariables: {
            primaryColor: '#d4956b',
            primaryTextColor: '#e8e0d8',
            primaryBorderColor: '#886644',
            lineColor: '#886644',
            secondaryColor: '#2a2520',
            tertiaryColor: '#1e1a16',
            background: '#0d0b09',
          },
        });

        const id = `mermaid-${Date.now()}`;
        const { svg: renderedSvg } = await mermaid.render(id, code);
        if (!cancelled) {
          setSvg(renderedSvg);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to render diagram');
          setSvg('');
        }
      }
    })();

    return () => { cancelled = true; };
  }, [code]);

  if (error) {
    return (
      <div className="p-4 rounded-lg" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
        <p className="text-sm" style={{ color: '#ef4444' }}>Mermaid Error: {error}</p>
        <pre className="mt-2 text-xs overflow-auto p-2 rounded" style={{ background: 'var(--color-code-bg)', color: 'var(--color-text-muted)' }}>
          {code}
        </pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex items-center justify-center p-4 overflow-auto"
      style={{ background: 'var(--color-bg-secondary)', minHeight: 200 }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
