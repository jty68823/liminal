'use client';

import { useState } from 'react';

interface Props {
  content: string;
  filename?: string;
  language?: string;
}

export function ArtifactExport({ content, filename, language }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const ext = language ? getExtension(language) : '.txt';
    const name = filename ?? `artifact${ext}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handleCopy}
        className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors hover:bg-white/10"
        style={{ color: copied ? '#4caf7d' : 'var(--color-text-muted)' }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {copied ? (
            <polyline points="20 6 9 17 4 12" />
          ) : (
            <>
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </>
          )}
        </svg>
        {copied ? 'Copied' : 'Copy'}
      </button>
      <button
        onClick={handleDownload}
        className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors hover:bg-white/10"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Download
      </button>
    </div>
  );
}

function getExtension(language: string): string {
  const map: Record<string, string> = {
    typescript: '.ts', javascript: '.js', python: '.py', rust: '.rs',
    html: '.html', css: '.css', json: '.json', markdown: '.md',
    tsx: '.tsx', jsx: '.jsx', go: '.go', java: '.java', sql: '.sql',
  };
  return map[language.toLowerCase()] ?? '.txt';
}
