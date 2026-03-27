'use client';

import { useState } from 'react';

interface FileTab {
  name: string;
  content: string;
  language?: string;
}

interface Props {
  files: FileTab[];
  onSelectFile?: (index: number) => void;
}

export function MultiFileArtifact({ files, onSelectFile }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);

  const handleSelect = (index: number) => {
    setActiveIndex(index);
    onSelectFile?.(index);
  };

  if (files.length === 0) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex overflow-x-auto border-b" style={{ borderColor: 'var(--color-border)' }}>
        {files.map((file, i) => (
          <button
            key={file.name}
            onClick={() => handleSelect(i)}
            className={`px-3 py-1.5 text-xs whitespace-nowrap transition-colors ${
              i === activeIndex ? 'border-b-2' : 'opacity-60 hover:opacity-100'
            }`}
            style={{
              color: i === activeIndex ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
              borderColor: i === activeIndex ? 'var(--color-accent-primary)' : 'transparent',
              background: i === activeIndex ? 'rgba(212,149,107,0.05)' : 'transparent',
            }}
          >
            {file.name}
          </button>
        ))}
      </div>

      {/* File content */}
      <div className="flex-1 overflow-auto">
        <pre className="p-4 text-sm" style={{
          background: 'var(--color-code-bg)',
          color: 'var(--color-text-primary)',
          fontFamily: 'var(--font-mono)',
        }}>
          <code>{files[activeIndex]?.content ?? ''}</code>
        </pre>
      </div>
    </div>
  );
}
